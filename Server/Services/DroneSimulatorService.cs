using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using NetTopologySuite.Geometries;

namespace DroneMonitoring.Server.Services;

public class DroneSimulatorService : BackgroundService
{
    private const int MIN_ACTIVE_DRONES = 5;
    private const int MAX_ACTIVE_DRONES = 10;
    private const int DEACTIVATION_CHANCE_INVERSE = 1500;

    private readonly IServiceProvider _serviceProvider;
    private readonly IHubContext<DroneTrackingHub> _hubContext;
    private readonly ILogger<DroneSimulatorService> _logger;
    private readonly Random _random = new();
    private readonly Dictionary<int, DroneState> _droneStates = new();

    // Кэшируем зоны для высокой производительности
    private List<CoverageZone> _cachedZones = new();

    private class DroneState
    {
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public double Altitude { get; set; }
        public double Speed { get; set; }
        public double Heading { get; set; }
        public string Status { get; set; } = "Inactive";
        public List<(double lat, double lon)> Route { get; set; } = new();
        public int CurrentWaypointIndex { get; set; } = 0;
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
        _logger.LogInformation("🚁 Drone Simulator Service started with DYNAMIC and DIVERSE routes");

        await InitializeSimulator();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SimulateAndBroadcast();
                await Task.Delay(1000, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in drone simulation");
                await Task.Delay(5000, stoppingToken);
            }
        }
    }

    private async Task InitializeSimulator()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        _cachedZones = await context.CoverageZones.ToListAsync();
        _logger.LogInformation("Cached {ZoneCount} coverage zones.", _cachedZones.Count);

        var drones = await context.Drones.ToListAsync();
        var shuffledDrones = drones.OrderBy(d => _random.Next()).ToList();

        double centerLat = 53.9006;
        double centerLon = 27.5615;

        for (int i = 0; i < shuffledDrones.Count; i++)
        {
            var drone = shuffledDrones[i];
            var state = new DroneState
            {
                Latitude = centerLat + (_random.NextDouble() - 0.5) * 0.1,
                Longitude = centerLon + (_random.NextDouble() - 0.5) * 0.1,
                Altitude = 100 + _random.Next(50, 200),
                Speed = 10 + _random.NextDouble() * 15,
                Heading = _random.Next(0, 360),
                Status = "Inactive"
            };

            if (i < MAX_ACTIVE_DRONES)
            {
                ActivateDrone(state, centerLat, centerLon);
            }

            _droneStates[drone.Id] = state;
        }

        _logger.LogInformation("Initialized {TotalCount} drones, {ActiveCount} are now active.", _droneStates.Count, _droneStates.Values.Count(s => s.Status == "Active"));
    }
    
    private void ActivateDrone(DroneState state, double centerLat, double centerLon)
    {
        state.Status = "Active";
        state.Route = GenerateRoute(centerLat, centerLon);
        state.CurrentWaypointIndex = 0;
        
        if (state.Route.Any())
        {
            state.Latitude = state.Route[0].lat;
            state.Longitude = state.Route[0].lon;
        }
    }

    private List<(double lat, double lon)> GenerateRoute(double centerLat, double centerLon)
    {
        var route = new List<(double lat, double lon)>();
        int routeType = _random.Next(0, 6);

        double routeCenterLat = centerLat + (_random.NextDouble() - 0.5) * 0.05;
        double routeCenterLon = centerLon + (_random.NextDouble() - 0.5) * 0.05;

        switch (routeType)
        {
            case 0: // Патрулирование (прямоугольник)
                {
                    double width = 0.01 + _random.NextDouble() * 0.02;
                    double height = 0.01 + _random.NextDouble() * 0.02;
                    route.Add((routeCenterLat - height / 2, routeCenterLon - width / 2));
                    route.Add((routeCenterLat + height / 2, routeCenterLon - width / 2));
                    route.Add((routeCenterLat + height / 2, routeCenterLon + width / 2));
                    route.Add((routeCenterLat - height / 2, routeCenterLon + width / 2));
                    break;
                }
            case 1: // Пересечение (случайные точки вокруг центра)
                {
                    int points = _random.Next(5, 9);
                    for (int i = 0; i < points; i++)
                    {
                        double angle = _random.NextDouble() * 2 * Math.PI;
                        double distance = 0.01 + _random.NextDouble() * 0.03;
                        route.Add((routeCenterLat + Math.Sin(angle) * distance, routeCenterLon + Math.Cos(angle) * distance));
                    }
                    break;
                }
            case 2: // Круговой маршрут (по или против часовой стрелки)
                {
                    double radius = 0.015 + _random.NextDouble() * 0.02;
                    int points = 12;
                    bool clockwise = _random.Next(2) == 0;
                    for (int i = 0; i < points; i++)
                    {
                        int step = clockwise ? i : points - 1 - i;
                        double angle = (step * 360.0 / points) * Math.PI / 180;
                        route.Add((routeCenterLat + Math.Sin(angle) * radius, routeCenterLon + Math.Cos(angle) * radius));
                    }
                    break;
                }
            case 3: // Восьмерка
                {
                    double radius = 0.01 + _random.NextDouble() * 0.01;
                    int pointsPerCircle = 8;
                    for (int i = 0; i <= pointsPerCircle; i++)
                    {
                        double angle = (i * 360.0 / pointsPerCircle) * Math.PI / 180;
                        route.Add((routeCenterLat + Math.Sin(angle) * radius, routeCenterLon - radius + Math.Cos(angle) * radius));
                    }
                    for (int i = 0; i <= pointsPerCircle; i++)
                    {
                        double angle = (i * 360.0 / pointsPerCircle) * Math.PI / 180;
                        route.Add((routeCenterLat - Math.Sin(angle) * radius, routeCenterLon + radius - Math.Cos(angle) * radius));
                    }
                    break;
                }
            case 4: // Зигзаг (сканирование области)
                {
                    double width = 0.03 + _random.NextDouble() * 0.02;
                    double height = 0.03 + _random.NextDouble() * 0.02;
                    int zigs = _random.Next(3, 5);
                    for (int i = 0; i <= zigs; i++)
                    {
                        route.Add((routeCenterLat - height / 2 + (i * height / zigs), routeCenterLon - width / 2));
                        route.Add((routeCenterLat - height / 2 + (i * height / zigs), routeCenterLon + width / 2));
                    }
                    break;
                }
            case 5: // Случайное блуждание
                {
                    var currentPoint = (lat: routeCenterLat, lon: routeCenterLon);
                    route.Add(currentPoint);
                    int points = _random.Next(8, 15);
                    for (int i = 0; i < points; i++)
                    {
                        currentPoint = (
                            lat: currentPoint.lat + (_random.NextDouble() - 0.5) * 0.015,
                            lon: currentPoint.lon + (_random.NextDouble() - 0.5) * 0.015
                        );
                        route.Add(currentPoint);
                    }
                    break;
                }
        }
        return route;
    }

    private async Task SimulateAndBroadcast()
    {
        ManageActiveDrones();

        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var updates = new List<object>();
        var telemetryRecords = new List<Telemetry>();

        foreach (var kvp in _droneStates)
        {
            var droneId = kvp.Key;
            var state = kvp.Value;

            if (state.Status == "Active")
            {
                SimulateDroneMovement(state);
            }

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

            if (state.Status == "Active")
            {
                telemetryRecords.Add(new Telemetry
                {
                    DroneId = droneId,
                    Position = new Point(state.Longitude, state.Latitude) { SRID = 4326 },
                    Altitude = state.Altitude,
                    Speed = state.Speed,
                    Heading = state.Heading,
                    Timestamp = DateTime.UtcNow
                });
            }
        }

        if (telemetryRecords.Any() && DateTime.UtcNow.Second % 10 == 0)
        {
            context.Telemetry.AddRange(telemetryRecords);
            
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
            await SendStatistics(context);
        }

        await _hubContext.Clients.All.SendAsync("DronesUpdated", updates);

        await BroadcastZoneActivity();
    }

    private void ManageActiveDrones()
    {
        var activeDronesCount = _droneStates.Values.Count(s => s.Status == "Active");

        if (activeDronesCount < MIN_ACTIVE_DRONES)
        {
            var inactiveDrone = _droneStates.FirstOrDefault(kvp => kvp.Value.Status == "Inactive");
            if (inactiveDrone.Value != null)
            {
                _logger.LogInformation("Drone {DroneId} activated to maintain minimum active count.", inactiveDrone.Key);
                ActivateDrone(inactiveDrone.Value, 53.9006, 27.5615);
            }
        }
    }

    private void SimulateDroneMovement(DroneState state)
    {
        if (state.Route.Count == 0) return;

        var target = state.Route[state.CurrentWaypointIndex];
        var deltaLat = target.lat - state.Latitude;
        var deltaLon = target.lon - state.Longitude;
        var distance = Math.Sqrt(deltaLat * deltaLat + deltaLon * deltaLon);

        if (distance < 0.0005)
        {
            state.CurrentWaypointIndex = (state.CurrentWaypointIndex + 1) % state.Route.Count;
        }

        var moveSpeed = 0.0001 + _random.NextDouble() * 0.00005;
        
        if (distance > 0)
        {
            state.Latitude += (deltaLat / distance) * moveSpeed;
            state.Longitude += (deltaLon / distance) * moveSpeed;
            state.Heading = (Math.Atan2(deltaLon, deltaLat) * 180 / Math.PI + 360) % 360;
        }

        state.Altitude = Math.Max(50, Math.Min(500, state.Altitude + _random.NextDouble() * 10 - 5));
        state.Speed = Math.Max(8, Math.Min(25, state.Speed + _random.NextDouble() * 3 - 1.5));

        var activeCount = _droneStates.Values.Count(s => s.Status == "Active");
        if (activeCount > MIN_ACTIVE_DRONES && _random.Next(DEACTIVATION_CHANCE_INVERSE) == 0)
        {
            state.Status = "Inactive";
            _logger.LogInformation("Drone deactivated randomly. Current active: {ActiveCount}", activeCount - 1);
        }
    }

    private async Task BroadcastZoneActivity()
    {
        if (!_cachedZones.Any()) return;

        var activeDrones = _droneStates
            .Where(kvp => kvp.Value.Status == "Active")
            .Select(kvp => new Point(kvp.Value.Longitude, kvp.Value.Latitude) { SRID = 4326 })
            .ToList();

        var activeZonesInfo = new List<object>();

        if (activeDrones.Any())
        {
            foreach (var zone in _cachedZones)
            {
                // ✅ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем точный геометрический метод Contains
                int dronesInZoneCount = activeDrones.Count(dronePoint => zone.Zone.Contains(dronePoint));

                if (dronesInZoneCount > 0)
                {
                    activeZonesInfo.Add(new
                    {
                        zoneId = zone.Id,
                        zoneName = zone.Name,
                        droneCount = dronesInZoneCount
                    });
                }
            }
        }
        
        await _hubContext.Clients.All.SendAsync("ZoneActivityUpdated", activeZonesInfo);
    }
    
    private async Task SendStatistics(ApplicationDbContext context)
    {
        var totalDrones = _droneStates.Count;
        var activeDrones = _droneStates.Values.Count(s => s.Status == "Active");
        
        var byFrequency = await context.Drones
            .GroupBy(d => d.Frequency)
            .Select(g => new { frequency = g.Key, count = g.Count() })
            .ToListAsync();

        var stats = new
        {
            total = totalDrones,
            active = activeDrones,
            inactive = totalDrones - activeDrones,
            byFrequency
        };

        await _hubContext.Clients.All.SendAsync("DroneStatistics", stats);
    }
}