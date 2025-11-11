using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using DroneMonitoring.Server.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite;

var builder = WebApplication.CreateBuilder(args);

// ===== ДИАГНОСТИКА: Проверяем переменные окружения =====
Console.WriteLine("========================================");
Console.WriteLine("🔍 RAILWAY ENVIRONMENT VARIABLES DEBUG:");
Console.WriteLine("========================================");

var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
var databasePrivateUrl = Environment.GetEnvironmentVariable("DATABASE_PRIVATE_URL");
var databasePublicUrl = Environment.GetEnvironmentVariable("DATABASE_PUBLIC_URL");
var railwayEnv = Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT");
var port = Environment.GetEnvironmentVariable("PORT");

Console.WriteLine($"DATABASE_URL: {(string.IsNullOrEmpty(databaseUrl) ? "❌ NOT SET" : $"✅ SET (length: {databaseUrl.Length})")}");
Console.WriteLine($"DATABASE_PRIVATE_URL: {(string.IsNullOrEmpty(databasePrivateUrl) ? "❌ NOT SET" : $"✅ SET (length: {databasePrivateUrl.Length})")}");
Console.WriteLine($"DATABASE_PUBLIC_URL: {(string.IsNullOrEmpty(databasePublicUrl) ? "❌ NOT SET" : $"✅ SET (length: {databasePublicUrl.Length})")}");
Console.WriteLine($"RAILWAY_ENVIRONMENT: {railwayEnv ?? "❌ NOT SET"}");
Console.WriteLine($"PORT: {port ?? "❌ NOT SET"}");

if (!string.IsNullOrEmpty(databaseUrl))
{
    Console.WriteLine($"DATABASE_URL first 50 chars: {databaseUrl.Substring(0, Math.Min(50, databaseUrl.Length))}...");
}
if (!string.IsNullOrEmpty(databasePrivateUrl))
{
    Console.WriteLine($"DATABASE_PRIVATE_URL first 50 chars: {databasePrivateUrl.Substring(0, Math.Min(50, databasePrivateUrl.Length))}...");
}

Console.WriteLine("========================================\n");

// Add services to the container
builder.Services.AddControllers();

// ===== DATABASE CONFIGURATION WITH DETAILED LOGGING =====
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    // ИСПРАВЛЕНО: Читаем DATABASE_URL из переменных окружения
    var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? Environment.GetEnvironmentVariable("DATABASE_PRIVATE_URL")
        ?? builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Host=localhost;Database=drone_monitoring;Username=postgres;Password=postgres";
    
    // Исправляем postgres:// на postgresql:// если нужно
    if (!string.IsNullOrEmpty(connectionString) && connectionString.StartsWith("postgres://"))
    {
        connectionString = connectionString.Replace("postgres://", "postgresql://");
    }
    
    options.UseNpgsql(connectionString, x => x.UseNetTopologySuite());
});

// SignalR для real-time
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
});

// Фоновый сервис симуляции дронов
builder.Services.AddHostedService<DroneSimulatorService>();

// CORS - Railway конфигурация
var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
var allowedOrigins = new List<string> { frontendUrl };

var railwayDomain = Environment.GetEnvironmentVariable("RAILWAY_PUBLIC_DOMAIN");
if (!string.IsNullOrEmpty(railwayDomain))
{
    allowedOrigins.Add($"https://{railwayDomain}");
    allowedOrigins.Add($"http://{railwayDomain}");
}

if (builder.Environment.IsDevelopment())
{
    allowedOrigins.Add("http://localhost:5173");
    allowedOrigins.Add("https://localhost:5173");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AppCors", policy =>
    {
        policy.WithOrigins(allowedOrigins.ToArray())
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseCors("AppCors");

var isRailway = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT"));
if (!isRailway)
{
    app.UseHttpsRedirection();
}

app.MapControllers();
app.MapHub<DroneTrackingHub>("/droneHub");

app.MapGet("/health", () => Results.Ok(new { 
    status = "healthy", 
    timestamp = DateTime.UtcNow,
    environment = new {
        isRailway = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT")),
        hasDatabaseUrl = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DATABASE_URL")),
        hasPrivateUrl = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DATABASE_PRIVATE_URL")),
        hasPublicUrl = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DATABASE_PUBLIC_URL"))
    }
}));

// --- Инициализация БД ---
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        logger.LogInformation("🔍 Checking database connection...");
        
        if (app.Environment.IsDevelopment())
        {
            logger.LogInformation("🔨 Development mode: Recreating database...");
            await context.Database.EnsureDeletedAsync();
            await context.Database.EnsureCreatedAsync();
            logger.LogInformation("✅ Database recreated for development");
        }
        else
        {
            logger.LogInformation("🚀 Production mode: Applying migrations...");
            await context.Database.MigrateAsync();
            logger.LogInformation("✅ Database migrations applied");
        }
        
        if (!await context.Drones.AnyAsync())
        {
            logger.LogInformation("🌱 Seeding database...");
            
            var drones = new List<Drone>();
            for (int i = 1; i <= 15; i++)
            {
                drones.Add(new Drone
                {
                    Name = $"Drone-{i:000}",
                    Frequency = (i % 3 == 0) ? "5.8 GHz" : "2.4 GHz",
                    Status = "Inactive",
                    LastSeen = DateTime.UtcNow
                });
            }
            
            context.Drones.AddRange(drones);
            await context.SaveChangesAsync();
            
            var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
            
            var zones = new[]
            {
                new CoverageZone
                {
                    Name = "Центральная зона",
                    Zone = CreateGeodesicCirclePolygon(geometryFactory, 27.5618, 53.9022, 2500),
                    RadiusMeters = 2500
                },
                new CoverageZone
                {
                    Name = "Северная зона",
                    Zone = CreateGeodesicCirclePolygon(geometryFactory, 27.6830, 53.9350, 2000),
                    RadiusMeters = 2000
                },
                new CoverageZone
                {
                    Name = "Южная зона",
                    Zone = CreateGeodesicCirclePolygon(geometryFactory, 27.6050, 53.8455, 3000),
                    RadiusMeters = 3000
                }
            };
            
            context.CoverageZones.AddRange(zones);
            await context.SaveChangesAsync();
            
            logger.LogInformation("✅ Database seeded with {DroneCount} drones and {ZoneCount} zones", 
                drones.Count, zones.Length);
        }
        else
        {
            logger.LogInformation("ℹ️ Database already contains data, skipping seed");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Error occurred during database initialization");
        throw;
    }
}

var serverPort = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Logger.LogInformation("🚁 Drone Monitoring API starting...");
app.Logger.LogInformation("📍 Environment: {Environment}", app.Environment.EnvironmentName);
app.Logger.LogInformation("🔌 Port: {Port}", serverPort);
app.Logger.LogInformation("🌐 Allowed CORS Origins: {Origins}", string.Join(", ", allowedOrigins));

app.Run($"http://0.0.0.0:{serverPort}");

static Polygon CreateGeodesicCirclePolygon(GeometryFactory factory, double centerLon, double centerLat, double radiusMeters)
{
    const int segments = 64;
    var coordinates = new Coordinate[segments + 1];
    
    const double metersPerDegreeLat = 111320.0;
    double metersPerDegreeLon = metersPerDegreeLat * Math.Cos(centerLat * Math.PI / 180.0);

    for (int i = 0; i < segments; i++)
    {
        var angle = (2 * Math.PI * i) / segments;
        var offsetX = radiusMeters * Math.Cos(angle);
        var offsetY = radiusMeters * Math.Sin(angle);
        var lon = centerLon + offsetX / metersPerDegreeLon;
        var lat = centerLat + offsetY / metersPerDegreeLat;
        coordinates[i] = new Coordinate(lon, lat);
    }
    
    coordinates[segments] = coordinates[0];
    return factory.CreatePolygon(coordinates);
}