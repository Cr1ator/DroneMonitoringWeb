using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace DroneMonitoring.Server.Data;

public class Drone
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public DateTime LastSeen { get; set; }
    public string Status { get; set; } = "Unknown";
    public ICollection<Telemetry> TelemetryData { get; set; } = new List<Telemetry>();
}

public class Telemetry
{
    public int Id { get; set; }
    public int DroneId { get; set; }
    public Drone Drone { get; set; } = null!;
    public Point Position { get; set; } = null!; // PostGIS Point
    public double Altitude { get; set; }
    public double Speed { get; set; }
    public double Heading { get; set; }
    public DateTime Timestamp { get; set; }
}

public class CoverageZone
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Polygon Zone { get; set; } = null!; // PostGIS Polygon
    public int RadiusMeters { get; set; }
}

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Drone> Drones => Set<Drone>();
    public DbSet<Telemetry> Telemetry => Set<Telemetry>();
    public DbSet<CoverageZone> CoverageZones => Set<CoverageZone>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // PostGIS типы
        modelBuilder.Entity<Telemetry>()
            .Property(t => t.Position)
            .HasColumnType("geometry(Point, 4326)");

        modelBuilder.Entity<CoverageZone>()
            .Property(c => c.Zone)
            .HasColumnType("geometry(Polygon, 4326)");

        // Индексы
        modelBuilder.Entity<Telemetry>()
            .HasIndex(t => t.Position)
            .HasMethod("GIST");

        modelBuilder.Entity<Telemetry>()
            .HasIndex(t => t.Timestamp);
    }
}