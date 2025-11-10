using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using DroneMonitoring.Server.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();

// Database с PostGIS
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Host=localhost;Database=drone_monitoring;Username=postgres;Password=postgres";
    
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

// CORS для React (localhost:5173)
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "https://localhost:5173")
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
    app.UseCors("DevCors"); // CORS только для development
}

app.UseHttpsRedirection();

// Маппинг Controllers и SignalR
app.MapControllers();
app.MapHub<DroneTrackingHub>("/droneHub");


// --- ИЗМЕНЕНО: Вся секция инициализации и наполнения БД ---
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        if (app.Environment.IsDevelopment())
        {
            // Пересоздаём БД при каждом запуске (для development)
            logger.LogInformation("Recreating database for development...");
            await context.Database.EnsureDeletedAsync();
            await context.Database.EnsureCreatedAsync();
            
            // Добавляем тестовые данные
            if (!await context.Drones.AnyAsync())
            {
                logger.LogInformation("Seeding database...");
                
                // --- ИЗМЕНЕНО: Увеличено количество дронов для лучшей симуляции ---
                var drones = new List<Drone>();
                for (int i = 1; i <= 15; i++)
                {
                    drones.Add(new Drone
                    {
                        Name = $"Drone-{i:000}",
                        Frequency = (i % 3 == 0) ? "5.8 GHz" : "2.4 GHz",
                        Status = "Inactive", // Все начинают как неактивные
                        LastSeen = DateTime.UtcNow
                    });
                }
                
                context.Drones.AddRange(drones);
                await context.SaveChangesAsync();
                
                // Добавляем зоны покрытия с новыми координатами
                var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
                
                var zones = new[]
                {
                    // --- ИЗМЕНЕНО: Новые координаты и радиусы ---
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
                
                logger.LogInformation("✅ Database seeded with {DroneCount} drones and {ZoneCount} coverage zones.", 
                    drones.Count, zones.Length);
            }
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Error occurred while seeding database");
    }
}

app.Logger.LogInformation("🚁 Drone Monitoring API started with real-time updates");

app.Run();

// --- ИЗМЕНЕНО: Полностью переписанный метод для создания геодезически-корректного круга ---
static Polygon CreateGeodesicCirclePolygon(GeometryFactory factory, double centerLon, double centerLat, double radiusMeters)
{
    const int segments = 64; // Больше сегментов для более гладкого круга
    var coordinates = new Coordinate[segments + 1];
    
    // Константы для расчетов
    const double metersPerDegreeLat = 111320.0;
    double metersPerDegreeLon = metersPerDegreeLat * Math.Cos(centerLat * Math.PI / 180.0);

    for (int i = 0; i < segments; i++)
    {
        var angle = (2 * Math.PI * i) / segments;
        
        // Вычисляем смещение в метрах
        var offsetX = radiusMeters * Math.Cos(angle);
        var offsetY = radiusMeters * Math.Sin(angle);
        
        // Конвертируем смещение в метрах в смещение в градусах
        var lon = centerLon + offsetX / metersPerDegreeLon;
        var lat = centerLat + offsetY / metersPerDegreeLat;
        
        coordinates[i] = new Coordinate(lon, lat);
    }
    
    // Замыкаем полигон, чтобы он был валидным
    coordinates[segments] = coordinates[0];
    
    return factory.CreatePolygon(coordinates);
}