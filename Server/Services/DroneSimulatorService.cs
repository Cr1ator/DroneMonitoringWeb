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
        public List<(double lat, double lon)> Route { get; set; } = new();
        public int CurrentWaypointIndex { get; set; } = 0;
        public int RouteType { get; set; } = 0;
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
        _logger.LogInformation("🚁 Drone Simulator Service started with enhanced routes");

        await InitializeDroneStates();

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

    private async Task InitializeDroneStates()
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var drones = await context.Drones
            .Include(d => d.TelemetryData.OrderByDescending(t => t.Timestamp).Take(1))
            .ToListAsync();

        double centerLat = 53.9006;
        double centerLon = 27.5615;

        foreach (var drone in drones)
        {
            var lastTelemetry = drone.TelemetryData.FirstOrDefault();
            var routeType = drone.Id % 3;

            var state = new DroneState
            {
                Latitude = lastTelemetry?.Position?.Y ?? centerLat + _random.NextDouble() * 0.03 - 0.015,
                Longitude = lastTelemetry?.Position?.X ?? centerLon + _random.NextDouble() * 0.03 - 0.015,
                Altitude = lastTelemetry?.Altitude ?? 100 + _random.Next(50, 200),
                Speed = lastTelemetry?.Speed ?? 10 + _random.NextDouble() * 15,
                Heading = lastTelemetry?.Heading ?? _random.Next(0, 360),
                Status = drone.Status,
                RouteType = routeType
            };

            state.Route = GenerateRoute(centerLat, centerLon, routeType, drone.Id);
            state.TargetLatitude = state.Route[0].lat;
            state.TargetLongitude = state.Route[0].lon;

            _droneStates[drone.Id] = state;
        }

        _logger.LogInformation("Initialized {Count} drones with diverse routes", _droneStates.Count);
    }

    private List<(double lat, double lon)> GenerateRoute(double centerLat, double centerLon, int routeType, int droneId)
    {
        var route = new List<(double lat, double lon)>();

        switch (routeType)
        {
            case 0: // Patrol
                {
                    double size = 0.02 + _random.NextDouble() * 0.02;
                    double offsetLat = (_random.NextDouble() - 0.5) * 0.02;
                    double offsetLon = (_random.NextDouble() - 0.5) * 0.02;
                    
                    route.Add((centerLat + offsetLat, centerLon + offsetLon));
                    route.Add((centerLat + offsetLat + size, centerLon + offsetLon));
                    route.Add((centerLat + offsetLat + size, centerLon + offsetLon + size));
                    route.Add((centerLat + offsetLat, centerLon + offsetLon + size));
                    break;
                }
            case 1: // Crossing
                {
                    double range = 0.04;
                    for (int i = 0; i < 6; i++)
                    {
                        double angle = (i * 60 + _random.Next(-15, 15)) * Math.PI / 180;
                        double distance = 0.015 + _random.NextDouble() * range;
                        route.Add((
                            centerLat + Math.Sin(angle) * distance,
                            centerLon + Math.Cos(angle) * distance
                        ));
                    }
                    break;
                }
            case 2: // Circular
                {
                    double radius = 0.02 + _random.NextDouble() * 0.015;
                    int points = 8;
                    for (int i = 0; i < points; i++)
                    {
                        double angle = (i * 360.0 / points) * Math.PI / 180;
                        route.Add((
                            centerLat + Math.Sin(angle) * radius,
                            centerLon + Math.Cos(angle) * radius
                        ));
                    }
                    break;
                }
        }

        return route;
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

            if (state.Status == "Active")
            {
                SimulateDroneMovement(state);
            }

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

        if (DateTime.UtcNow.Second % 10 == 0)
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
        await CheckDronesInZones(context, updates);
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
            target = state.Route[state.CurrentWaypointIndex];
            deltaLat = target.lat - state.Latitude;
            deltaLon = target.lon - state.Longitude;
            distance = Math.Sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
        }

        var moveSpeed = 0.0001 + _random.NextDouble() * 0.00005;
        
        if (distance > 0)
        {
            state.Latitude += (deltaLat / distance) * moveSpeed;
            state.Longitude += (deltaLon / distance) * moveSpeed;
            
            state.Heading = Math.Atan2(deltaLon, deltaLat) * 180 / Math.PI;
            if (state.Heading < 0) state.Heading += 360;
        }

        state.Altitude = Math.Max(50, Math.Min(500, state.Altitude + _random.NextDouble() * 10 - 5));
        state.Speed = Math.Max(8, Math.Min(25, state.Speed + _random.NextDouble() * 3 - 1.5));

        if (_random.Next(1000) == 0)
        {
            state.Status = state.Status == "Active" ? "Inactive" : "Active";
            _logger.LogInformation("Drone status changed to: {Status}", state.Status);
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
    }
}