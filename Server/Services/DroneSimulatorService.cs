using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using NetTopologySuite.Geometries;
using System.Text.Json;

namespace DroneMonitoring.Server.Services;

public class DroneSimulatorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IHubContext<DroneTrackingHub> _hubContext;
    private readonly ILogger<DroneSimulatorService> _logger;
    private readonly Random _random = new();
    private readonly Dictionary<int, DroneState> _droneStates = new();

    private class DroneState
    {
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public double Altitude { get; set; }
        public double Speed { get; set; }
        public double Heading { get; set; }
        public string Status { get; set; } = "Active";
        public double TargetLatitude { get; set; }
        public double TargetLongitude { get; set; }
    }

    public DroneSimulatorService(
        IServiceProvider serviceProvider,
        IHubContext<DroneTrackingHub> hubContext,
        ILogger<DroneSimulatorService> logger)
    {
        _serviceProvider = serviceProvider;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("🚁 Drone Simulator Service started");

        // Инициализация состояний дронов
        await InitializeDroneStates();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SimulateAndBroadcast();
                await Task.Delay(1000, stoppingToken); // Обновление каждую секунду
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in drone simulation");
                await Task.Delay(5000, stoppingToken); // Пауза при ошибке
            }
        }
    }

    private async Task InitializeDroneStates()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var drones = await context.Drones
            .Include(d => d.TelemetryData.OrderByDescending(t => t.Timestamp).Take(1))
            .ToListAsync();

        foreach (var drone in drones)
        {
            var lastTelemetry = drone.TelemetryData.FirstOrDefault();
            
            _droneStates[drone.Id] = new DroneState
            {
                Latitude = lastTelemetry?.Position?.Y ?? 53.9006 + _random.NextDouble() * 0.02 - 0.01,
                Longitude = lastTelemetry?.Position?.X ?? 27.5615 + _random.NextDouble() * 0.02 - 0.01,
                Altitude = lastTelemetry?.Altitude ?? 100 + _random.Next(50, 200),
                Speed = lastTelemetry?.Speed ?? 10 + _random.NextDouble() * 20,
                Heading = lastTelemetry?.Heading ?? _random.Next(0, 360),
                Status = drone.Status,
                TargetLatitude = 53.9006 + _random.NextDouble() * 0.05 - 0.025,
                TargetLongitude = 27.5615 + _random.NextDouble() * 0.05 - 0.025
            };
        }

        _logger.LogInformation("Initialized {Count} drone states", _droneStates.Count);
    }

    private async Task SimulateAndBroadcast()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var updates = new List<object>();
        var telemetryRecords = new List<Telemetry>();

        foreach (var kvp in _droneStates)
        {
            var droneId = kvp.Key;
            var state = kvp.Value;

            // Симуляция движения только для активных дронов
            if (state.Status == "Active")
            {
                SimulateDroneMovement(state);
            }

            // Создаём запись телеметрии
            var telemetry = new Telemetry
            {
                DroneId = droneId,
                Position = new Point(state.Longitude, state.Latitude) { SRID = 4326 },
                Altitude = state.Altitude,
                Speed = state.Speed,
                Heading = state.Heading,
                Timestamp = DateTime.UtcNow
            };

            telemetryRecords.Add(telemetry);

            // Подготавливаем данные для отправки клиентам
            var update = new
            {
                id = droneId,
                latitude = state.Latitude,
                longitude = state.Longitude,
                altitude = state.Altitude,
                speed = state.Speed,
                heading = state.Heading,
                status = state.Status,
                timestamp = DateTime.UtcNow
            };

            updates.Add(update);
        }

        // Сохраняем телеметрию в БД (каждые 10 секунд для оптимизации)
        if (DateTime.UtcNow.Second % 10 == 0)
        {
            context.Telemetry.AddRange(telemetryRecords);
            
            // ✅ ИСПРАВЛЕНО #5: Обновляем статус дронов в БД
            foreach (var kvp in _droneStates)
            {
                var drone = await context.Drones.FindAsync(kvp.Key);
                if (drone != null)
                {
                    drone.Status = kvp.Value.Status;
                    drone.LastSeen = DateTime.UtcNow;
                }
            }
            
            await context.SaveChangesAsync();
            
            // ✅ ИСПРАВЛЕНО #5: Отправляем обновлённую статистику
            await SendStatistics(context);
        }

        // Отправляем обновления через SignalR
        await _hubContext.Clients.All.SendAsync("DronesUpdated", updates);

        // Проверяем дроны в зонах покрытия
        await CheckDronesInZones(context, updates);
    }

    private void SimulateDroneMovement(DroneState state)
    {
        // Движение к целевой точке
        var deltaLat = state.TargetLatitude - state.Latitude;
        var deltaLon = state.TargetLongitude - state.Longitude;
        var distance = Math.Sqrt(deltaLat * deltaLat + deltaLon * deltaLon);

        if (distance < 0.001) // Достигли цели, выбираем новую
        {
            state.TargetLatitude = 53.9006 + _random.NextDouble() * 0.05 - 0.025;
            state.TargetLongitude = 27.5615 + _random.NextDouble() * 0.05 - 0.025;
        }
        else
        {
            // Двигаемся к цели
            var moveSpeed = 0.0001; // Скорость движения
            state.Latitude += (deltaLat / distance) * moveSpeed;
            state.Longitude += (deltaLon / distance) * moveSpeed;
            
            // Обновляем направление
            state.Heading = Math.Atan2(deltaLon, deltaLat) * 180 / Math.PI;
            if (state.Heading < 0) state.Heading += 360;
        }

        // Случайные изменения высоты и скорости
        state.Altitude = Math.Max(50, Math.Min(500, state.Altitude + _random.NextDouble() * 10 - 5));
        state.Speed = Math.Max(5, Math.Min(30, state.Speed + _random.NextDouble() * 4 - 2));

        // ✅ ИСПРАВЛЕНО #5: Редко меняем статус (1% шанс каждую итерацию)
        if (_random.Next(100) == 0)
        {
            state.Status = state.Status == "Active" ? "Inactive" : "Active";
            _logger.LogInformation("Drone status changed: {Status}", state.Status);
        }
    }

    private async Task CheckDronesInZones(ApplicationDbContext context, List<object> updates)
    {
        var zones = await context.CoverageZones.ToListAsync();
        if (!zones.Any()) return;

        foreach (var zone in zones)
        {
            var dronesInZone = updates.Where(u =>
            {
                dynamic d = u;
                var dronePoint = new Point(d.longitude, d.latitude) { SRID = 4326 };
                return zone.Zone?.Contains(dronePoint) ?? false;
            }).ToList();

            if (dronesInZone.Any())
            {
                await _hubContext.Clients.Group($"zone_{zone.Id}")
                    .SendAsync("DronesInZoneUpdated", new
                    {
                        zoneId = zone.Id,
                        zoneName = zone.Name,
                        drones = dronesInZone
                    });
            }
        }
    }

    // ✅ ИСПРАВЛЕНО #5: Метод для отправки точной статистики
    private async Task SendStatistics(ApplicationDbContext context)
    {
        var totalDrones = await context.Drones.CountAsync();
        var activeDrones = await context.Drones.CountAsync(d => d.Status == "Active");
        var inactiveDrones = await context.Drones.CountAsync(d => d.Status == "Inactive");
        
        var byFrequency = await context.Drones
            .GroupBy(d => d.Frequency)
            .Select(g => new { frequency = g.Key, count = g.Count() })
            .ToListAsync();

        var stats = new
        {
            total = totalDrones,
            active = activeDrones,
            inactive = inactiveDrones,
            byFrequency
        };

        await _hubContext.Clients.All.SendAsync("DroneStatistics", stats);
        _logger.LogInformation("Statistics sent: Active={Active}, Inactive={Inactive}", activeDrones, inactiveDrones);
    }
}