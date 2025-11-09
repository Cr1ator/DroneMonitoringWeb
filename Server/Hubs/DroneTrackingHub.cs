using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using DroneMonitoring.Server.Data;
using NetTopologySuite.Geometries;

namespace DroneMonitoring.Server.Hubs;

public class DroneTrackingHub : Hub
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DroneTrackingHub> _logger;

    public DroneTrackingHub(ApplicationDbContext context, ILogger<DroneTrackingHub> logger)
    {
        _context = context;
        _logger = logger;
    }

    // Подписка на обновления всех дронов
    public async Task SubscribeToAllDrones()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "all_drones");
        await Clients.Caller.SendAsync("Subscribed", new { group = "all_drones", message = "Subscribed to all drones" });
        
        // Отправляем текущее состояние всех дронов
        await SendCurrentDroneStates();
    }

    // Подписка на конкретную зону покрытия
    public async Task SubscribeToZone(int zoneId)
    {
        var zone = await _context.CoverageZones.FindAsync(zoneId);
        if (zone != null)
        {
            var groupName = $"zone_{zoneId}";
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            await Clients.Caller.SendAsync("Subscribed", new { 
                group = groupName, 
                message = $"Subscribed to zone: {zone.Name}",
                zone = new { zone.Id, zone.Name, zone.RadiusMeters }
            });
        }
    }

    // Отписка от зоны
    public async Task UnsubscribeFromZone(int zoneId)
    {
        var groupName = $"zone_{zoneId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        await Clients.Caller.SendAsync("Unsubscribed", new { group = groupName });
    }

    // Получить траекторию дрона
    public async Task GetDroneTrajectory(int droneId, int hours = 1)
    {
        var startTime = DateTime.UtcNow.AddHours(-hours);
        
        var trajectory = await _context.Telemetry
            .Where(t => t.DroneId == droneId && t.Timestamp >= startTime)
            .OrderBy(t => t.Timestamp)
            .Select(t => new
            {
                lat = t.Position.Y,
                lon = t.Position.X,
                altitude = t.Altitude,
                speed = t.Speed,
                heading = t.Heading,
                timestamp = t.Timestamp
            })
            .ToListAsync();

        await Clients.Caller.SendAsync("DroneTrajectory", new
        {
            droneId,
            points = trajectory,
            requestedHours = hours
        });
    }

    // Получить зоны покрытия
    public async Task GetCoverageZones()
    {
        var zones = await _context.CoverageZones
            .Select(z => new
            {
                id = z.Id,
                name = z.Name,
                centerLat = z.Zone.Centroid.Y,
                centerLon = z.Zone.Centroid.X,
                radiusMeters = z.RadiusMeters
            })
            .ToListAsync();

        await Clients.Caller.SendAsync("CoverageZones", zones);
    }

    // Получить статистику дронов
    public async Task GetDroneStatistics()
    {
        var totalDrones = await _context.Drones.CountAsync();
        var activeDrones = await _context.Drones.CountAsync(d => d.Status == "Active");
        var inactiveDrones = await _context.Drones.CountAsync(d => d.Status == "Inactive");
        
        var byFrequency = await _context.Drones
            .GroupBy(d => d.Frequency)
            .Select(g => new { frequency = g.Key, count = g.Count() })
            .ToListAsync();

        await Clients.Caller.SendAsync("DroneStatistics", new
        {
            total = totalDrones,
            active = activeDrones,
            inactive = inactiveDrones,
            byFrequency
        });
    }

    // Применить фильтры дронов
    public async Task ApplyDroneFilters(DroneFilters filters)
    {
        var query = _context.Drones.AsQueryable();

        if (filters.StatusFilter != null && filters.StatusFilter.Any())
        {
            query = query.Where(d => filters.StatusFilter.Contains(d.Status));
        }

        if (filters.FrequencyFilter != null && filters.FrequencyFilter.Any())
        {
            query = query.Where(d => filters.FrequencyFilter.Contains(d.Frequency));
        }

        var filteredDrones = await query
            .Select(d => new
            {
                id = d.Id,
                name = d.Name,
                frequency = d.Frequency,
                status = d.Status,
                lastSeen = d.LastSeen
            })
            .ToListAsync();

        await Clients.Caller.SendAsync("FilteredDrones", filteredDrones);
    }

    // При подключении клиента
    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation($"Client connected: {Context.ConnectionId}");
        
        await Clients.Caller.SendAsync("Connected", new
        {
            connectionId = Context.ConnectionId,
            serverTime = DateTime.UtcNow,
            message = "Successfully connected to DroneTracking Hub"
        });
        
        // Автоматически подписываем на все дроны
        await SubscribeToAllDrones();
        
        // Отправляем зоны покрытия
        await GetCoverageZones();
        
        // Отправляем статистику
        await GetDroneStatistics();
        
        await base.OnConnectedAsync();
    }

    // При отключении клиента
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation($"Client disconnected: {Context.ConnectionId}");
        await base.OnDisconnectedAsync(exception);
    }

    // Вспомогательный метод для отправки текущего состояния дронов
    private async Task SendCurrentDroneStates()
    {
        var drones = await _context.Drones
            .Include(d => d.TelemetryData.OrderByDescending(t => t.Timestamp).Take(1))
            .Select(d => new
            {
                id = d.Id,
                name = d.Name,
                frequency = d.Frequency,
                status = d.Status,
                lastSeen = d.LastSeen,
                currentPosition = d.TelemetryData.Select(t => new
                {
                    latitude = t.Position.Y,
                    longitude = t.Position.X,
                    altitude = t.Altitude,
                    speed = t.Speed,
                    heading = t.Heading,
                    timestamp = t.Timestamp
                }).FirstOrDefault()
            })
            .ToListAsync();

        await Clients.Caller.SendAsync("InitialDronesState", drones);
    }
}

// DTO для фильтров
public class DroneFilters
{
    public List<string>? StatusFilter { get; set; }
    public List<string>? FrequencyFilter { get; set; }
}
