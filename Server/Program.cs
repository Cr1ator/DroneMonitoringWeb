using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using DroneMonitoring.Server.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();

// Database с PostGIS - Railway конфигурация
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    // Railway предоставляет DATABASE_URL или DATABASE_PUBLIC_URL
    var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? Environment.GetEnvironmentVariable("DATABASE_PUBLIC_URL")
        ?? builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Host=localhost;Database=drone_monitoring;Username=postgres;Password=postgres";
    
    // Railway PostgreSQL требует SSL
    if (connectionString.Contains("railway"))
    {
        connectionString += ";SSL Mode=Require;Trust Server Certificate=true";
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
// Railway предоставляет RAILWAY_PUBLIC_DOMAIN для backend
// Frontend будет на своём домене или поддомене
var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL")
    ?? Environment.GetEnvironmentVariable("RAILWAY_STATIC_URL")
    ?? "http://localhost:5173";

var allowedOrigins = new List<string> { frontendUrl };

// Добавляем Railway домены если они есть
var railwayDomain = Environment.GetEnvironmentVariable("RAILWAY_PUBLIC_DOMAIN");
if (!string.IsNullOrEmpty(railwayDomain))
{
    allowedOrigins.Add($"https://{railwayDomain}");
    allowedOrigins.Add($"http://{railwayDomain}");
}

// Для локальной разработки
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

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

// Используем CORS
app.UseCors("AppCors");

// HTTPS редирект только если не на Railway (Railway делает это за нас)
var isRailway = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("RAILWAY_ENVIRONMENT"));
if (!isRailway)
{
    app.UseHttpsRedirection();
}

// Маппинг Controllers и SignalR
app.MapControllers();
app.MapHub<DroneTrackingHub>("/droneHub");

// Health check для Railway
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

// --- Инициализация БД ---
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        // Применяем миграции или создаём БД
        logger.LogInformation("Checking database...");
        
        if (app.Environment.IsDevelopment())
        {
            // Development: пересоздаём БД
            await context.Database.EnsureDeletedAsync();
            await context.Database.EnsureCreatedAsync();
            logger.LogInformation("Database recreated for development");
        }
        else
        {
            // Production: применяем миграции
            await context.Database.MigrateAsync();
            logger.LogInformation("Database migrations applied");
        }
        
        // Seed данные если БД пустая
        if (!await context.Drones.AnyAsync())
        {
            logger.LogInformation("Seeding database...");
            
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
            
            // Зоны покрытия
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
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Error occurred during database initialization");
        throw; // Не запускаем приложение если БД недоступна
    }
}

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Logger.LogInformation("🚁 Drone Monitoring API started");
app.Logger.LogInformation("Environment: {Environment}", app.Environment.EnvironmentName);
app.Logger.LogInformation("Port: {Port}", port);
app.Logger.LogInformation("Allowed CORS Origins: {Origins}", string.Join(", ", allowedOrigins));

// Railway использует переменную PORT
app.Run($"http://0.0.0.0:{port}");

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