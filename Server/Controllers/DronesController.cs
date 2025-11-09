using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using NetTopologySuite.Geometries;

namespace DroneMonitoring.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DronesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<DroneTrackingHub> _hubContext;
    private readonly ILogger<DronesController> _logger;

    public DronesController(
        ApplicationDbContext context,
        IHubContext<DroneTrackingHub> hubContext,
        ILogger<DronesController> logger)
    {
        _context = context;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Получить список всех дронов
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetDrones()
    {
        var drones = await _context.Drones
            .Include(d => d.TelemetryData.OrderByDescending(t => t.Timestamp).Take(1))
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Frequency,
                d.LastSeen,
                d.Status,
                CurrentPosition = d.TelemetryData.Select(t => new
                {
                    Latitude = t.Position.Y,
                    Longitude = t.Position.X,
                    t.Altitude,
                    t.Speed,
                    t.Heading,
                    t.Timestamp
                }).FirstOrDefault()
            })
            .ToListAsync();

        return Ok(drones);
    }

    /// <summary>
    /// Получить информацию о конкретном дроне
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetDrone(int id)
    {
        var drone = await _context.Drones
            .Include(d => d.TelemetryData.OrderByDescending(t => t.Timestamp).Take(1))
            .Where(d => d.Id == id)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Frequency,
                d.LastSeen,
                d.Status,
                CurrentPosition = d.TelemetryData.Select(t => new
                {
                    Latitude = t.Position.Y,
                    Longitude = t.Position.X,
                    t.Altitude,
                    t.Speed,
                    t.Heading,
                    t.Timestamp
                }).FirstOrDefault()
            })
            .FirstOrDefaultAsync();

        if (drone == null)
        {
            return NotFound();
        }

        return Ok(drone);
    }

    /// <summary>
    /// Получить дронов в определённой зоне
    /// </summary>
    [HttpGet("in-zone")]
    public async Task<ActionResult<IEnumerable<object>>> GetDronesInZone(
        [FromQuery] double lat,
        [FromQuery] double lon,
        [FromQuery] double radiusMeters)
    {
        try
        {
            var point = new Point(lon, lat) { SRID = 4326 };

            var drones = await _context.Telemetry
                .Where(t => t.Position.IsWithinDistance(point, radiusMeters))
                .OrderByDescending(t => t.Timestamp)
                .GroupBy(t => t.DroneId)
                .Select(g => g.OrderByDescending(t => t.Timestamp).First())
                .Include(t => t.Drone)
                .Select(t => new
                {
                    t.Drone.Id,
                    t.Drone.Name,
                    t.Drone.Frequency,
                    t.Drone.Status,
                    Latitude = t.Position.Y,
                    Longitude = t.Position.X,
                    t.Altitude,
                    t.Speed,
                    t.Heading,
                    t.Timestamp
                })
                .ToListAsync();

            return Ok(drones);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting drones in zone");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Получить историю полётов дрона
    /// </summary>
    [HttpGet("{id}/history")]
    public async Task<ActionResult<IEnumerable<object>>> GetDroneHistory(
        int id, 
        [FromQuery] int limit = 100,
        [FromQuery] int? hours = null)
    {
        try
        {
            var query = _context.Telemetry
                .Where(t => t.DroneId == id);

            // Если указано количество часов, фильтруем по времени
            if (hours.HasValue)
            {
                var startTime = DateTime.UtcNow.AddHours(-hours.Value);
                query = query.Where(t => t.Timestamp >= startTime);
            }

            var history = await query
                .OrderByDescending(t => t.Timestamp)
                .Take(limit)
                .Select(t => new
                {
                    Latitude = t.Position.Y,
                    Longitude = t.Position.X,
                    t.Altitude,
                    t.Speed,
                    t.Heading,
                    t.Timestamp
                })
                .ToListAsync();

            return Ok(history);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting drone history for drone {DroneId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Получить траекторию полёта дрона
    /// </summary>
    [HttpGet("{id}/trajectory")]
    public async Task<ActionResult<object>> GetDroneTrajectory(
        int id, 
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        try
        {
            var query = _context.Telemetry.Where(t => t.DroneId == id);

            if (from.HasValue)
                query = query.Where(t => t.Timestamp >= from.Value);
            
            if (to.HasValue)
                query = query.Where(t => t.Timestamp <= to.Value);

            var points = await query
                .OrderBy(t => t.Timestamp)
                .Select(t => new
                {
                    Lat = t.Position.Y,
                    Lon = t.Position.X,
                    Alt = t.Altitude,
                    Time = t.Timestamp
                })
                .ToListAsync();

            return Ok(new
            {
                DroneId = id,
                PointCount = points.Count,
                Points = points,
                From = from,
                To = to
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting trajectory for drone {DroneId}", id);
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Получить статистику по дронам
    /// </summary>
    [HttpGet("statistics")]
    public async Task<ActionResult<object>> GetStatistics()
    {
        try
        {
            var totalDrones = await _context.Drones.CountAsync();
            var activeDrones = await _context.Drones.CountAsync(d => d.Status == "Active");
            var inactiveDrones = await _context.Drones.CountAsync(d => d.Status == "Inactive");
            
            var byFrequency = await _context.Drones
                .GroupBy(d => d.Frequency)
                .Select(g => new 
                { 
                    Frequency = g.Key, 
                    Count = g.Count() 
                })
                .ToListAsync();

            var avgAltitude = await _context.Telemetry
                .Where(t => t.Timestamp >= DateTime.UtcNow.AddHours(-1))
                .AverageAsync(t => (double?)t.Altitude) ?? 0;

            var avgSpeed = await _context.Telemetry
                .Where(t => t.Timestamp >= DateTime.UtcNow.AddHours(-1))
                .AverageAsync(t => (double?)t.Speed) ?? 0;

            return Ok(new
            {
                Total = totalDrones,
                Active = activeDrones,
                Inactive = inactiveDrones,
                ByFrequency = byFrequency,
                AverageAltitude = Math.Round(avgAltitude, 1),
                AverageSpeed = Math.Round(avgSpeed, 1)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting drone statistics");
            return StatusCode(500, "Internal server error");
        }
    }
}

/// <summary>
/// Контроллер для управления зонами покрытия
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ZonesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ZonesController> _logger;

    public ZonesController(ApplicationDbContext context, ILogger<ZonesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Получить все зоны покрытия
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetZones()
    {
        try
        {
            var zones = await _context.CoverageZones
                .Select(z => new
                {
                    z.Id,
                    z.Name,
                    CenterLat = z.Zone.Centroid.Y,
                    CenterLon = z.Zone.Centroid.X,
                    z.RadiusMeters
                })
                .ToListAsync();

            return Ok(zones);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting coverage zones");
            return StatusCode(500, "Internal server error");
        }
    }

    /// <summary>
    /// Получить дронов в конкретной зоне
    /// </summary>
    [HttpGet("{id}/drones")]
    public async Task<ActionResult<IEnumerable<object>>> GetDronesInZone(int id)
    {
        try
        {
            var zone = await _context.CoverageZones.FindAsync(id);
            if (zone == null)
                return NotFound();

            var dronesInZone = await _context.Telemetry
                .Where(t => zone.Zone.Contains(t.Position))
                .GroupBy(t => t.DroneId)
                .Select(g => g.OrderByDescending(t => t.Timestamp).First())
                .Include(t => t.Drone)
                .Select(t => new
                {
                    t.Drone.Id,
                    t.Drone.Name,
                    t.Drone.Frequency,
                    t.Drone.Status,
                    Latitude = t.Position.Y,
                    Longitude = t.Position.X,
                    t.Altitude,
                    t.Speed,
                    t.Heading,
                    t.Timestamp
                })
                .ToListAsync();

            return Ok(new
            {
                Zone = new
                {
                    zone.Id,
                    zone.Name,
                    zone.RadiusMeters
                },
                Drones = dronesInZone,
                DroneCount = dronesInZone.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting drones in zone {ZoneId}", id);
            return StatusCode(500, "Internal server error");
        }
    }
}
