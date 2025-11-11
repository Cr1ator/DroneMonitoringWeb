using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using DroneMonitoring.Server.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();

// ===== DATABASE CONFIGURATION WITH URI PARSER =====
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    string? connectionString = null;
    
    // Пробуем получить connection string из разных источников
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    var databasePrivateUrl = Environment.GetEnvironmentVariable("DATABASE_PRIVATE_URL");
    var databasePublicUrl = Environment.GetEnvironmentVariable("DATABASE_PUBLIC_URL");
    
    if (!string.IsNullOrEmpty(databaseUrl))
    {
        connectionString = ConvertUriToConnectionString(databaseUrl);
        Console.WriteLine($"📊 Using DATABASE_URL (converted from URI)");
    }
    else if (!string.IsNullOrEmpty(databasePrivateUrl))
    {
        connectionString = ConvertUriToConnectionString(databasePrivateUrl);
        Console.WriteLine($"📊 Using DATABASE_PRIVATE_URL (converted from URI)");
    }
    else if (!string.IsNullOrEmpty(databasePublicUrl))
    {
        connectionString = ConvertUriToConnectionString(databasePublicUrl);
        Console.WriteLine($"📊 Using DATABASE_PUBLIC_URL (converted from URI)");
    }
    else
    {
        connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Database=drone_monitoring;Username=postgres;Password=postgres";
        Console.WriteLine($"📊 Using fallback connection string");
    }
    
    if (string.IsNullOrEmpty(connectionString))
    {
        throw new InvalidOperationException("DATABASE_URL is not configured properly");
    }
    
    Console.WriteLine($"✅ Connection string ready (length: {connectionString.Length})");
    Console.WriteLine($"   Preview: {connectionString.Substring(0, Math.Min(60, connectionString.Length))}...\n");
    
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
    database = "configured"
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

// ===== HELPER: Convert PostgreSQL URI to Connection String =====
static string ConvertUriToConnectionString(string databaseUrl)
{
    try
    {
        // Если уже в формате Keyword/Value - возвращаем как есть
        if (!databaseUrl.StartsWith("postgres://") && !databaseUrl.StartsWith("postgresql://"))
        {
            return databaseUrl;
        }
        
        // Парсим URI
        var uri = new Uri(databaseUrl.Replace("postgres://", "postgresql://"));
        
        var host = uri.Host;
        var port = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.TrimStart('/');
        var username = uri.UserInfo.Split(':')[0];
        var password = uri.UserInfo.Contains(':') ? uri.UserInfo.Split(':')[1] : "";
        
        // Конвертируем в Npgsql connection string формат
        var connectionString = $"Host={host};Port={port};Database={database};Username={username};Password={password}";
        
        // Добавляем SSL параметры если нужно
        if (host.Contains("railway.internal") || host.Contains(".railway.app") || host.Contains("proxy.rlwy.net"))
        {
            connectionString += ";SSL Mode=Require;Trust Server Certificate=true";
        }
        
        Console.WriteLine($"🔄 Converted URI to connection string");
        Console.WriteLine($"   Host: {host}");
        Console.WriteLine($"   Port: {port}");
        Console.WriteLine($"   Database: {database}");
        Console.WriteLine($"   Username: {username}");
        
        return connectionString;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Error converting URI: {ex.Message}");
        throw new InvalidOperationException($"Failed to parse DATABASE_URL: {ex.Message}", ex);
    }
}

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