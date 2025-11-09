using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using DroneMonitoring.Server.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddOpenApi();

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

// Controllers для API endpoints
builder.Services.AddControllers();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors("DevCors"); // CORS только для development
}

app.UseHttpsRedirection();

// Маппинг Controllers и SignalR
app.MapControllers();
app.MapHub<DroneTrackingHub>("/droneHub");

// Оригинальный weather endpoint (можно оставить для теста)
var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

// Инициализация БД и seed тестовых данных
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        if (app.Environment.IsDevelopment())
        {
            // Пересоздаём БД при каждом запуске (для development)
            await context.Database.EnsureDeletedAsync();
            await context.Database.EnsureCreatedAsync();
            
            // Добавляем тестовые данные
            if (!await context.Drones.AnyAsync())
            {
                var drones = new[]
                {
                    new Drone 
                    { 
                        Name = "Drone-001", 
                        Frequency = "2.4 GHz", 
                        Status = "Active", 
                        LastSeen = DateTime.UtcNow 
                    },
                    new Drone 
                    { 
                        Name = "Drone-002", 
                        Frequency = "5.8 GHz", 
                        Status = "Active", 
                        LastSeen = DateTime.UtcNow 
                    },
                    new Drone 
                    { 
                        Name = "Drone-003", 
                        Frequency = "2.4 GHz", 
                        Status = "Inactive", 
                        LastSeen = DateTime.UtcNow.AddHours(-2) 
                    },
                    new Drone 
                    { 
                        Name = "Drone-004", 
                        Frequency = "5.8 GHz", 
                        Status = "Active", 
                        LastSeen = DateTime.UtcNow 
                    },
                    new Drone 
                    { 
                        Name = "Drone-005", 
                        Frequency = "2.4 GHz", 
                        Status = "Active", 
                        LastSeen = DateTime.UtcNow 
                    }
                };
                
                context.Drones.AddRange(drones);
                await context.SaveChangesAsync();
                
                // Тестовая телеметрия (координаты Минска)
                var telemetry = new[]
                {
                    new Telemetry 
                    { 
                        DroneId = 1, 
                        Position = new Point(27.5615, 53.9006) { SRID = 4326 },
                        Altitude = 100,
                        Speed = 15.5,
                        Heading = 45,
                        Timestamp = DateTime.UtcNow
                    },
                    new Telemetry 
                    { 
                        DroneId = 2, 
                        Position = new Point(27.5715, 53.9106) { SRID = 4326 },
                        Altitude = 150,
                        Speed = 20.0,
                        Heading = 180,
                        Timestamp = DateTime.UtcNow
                    },
                    new Telemetry 
                    { 
                        DroneId = 3, 
                        Position = new Point(27.5515, 53.8906) { SRID = 4326 },
                        Altitude = 80,
                        Speed = 10.0,
                        Heading = 270,
                        Timestamp = DateTime.UtcNow.AddHours(-2)
                    },
                    new Telemetry 
                    { 
                        DroneId = 4, 
                        Position = new Point(27.5815, 53.9006) { SRID = 4326 },
                        Altitude = 200,
                        Speed = 25.0,
                        Heading = 90,
                        Timestamp = DateTime.UtcNow
                    },
                    new Telemetry 
                    { 
                        DroneId = 5, 
                        Position = new Point(27.5615, 53.8906) { SRID = 4326 },
                        Altitude = 120,
                        Speed = 18.0,
                        Heading = 135,
                        Timestamp = DateTime.UtcNow
                    }
                };
                
                context.Telemetry.AddRange(telemetry);
                await context.SaveChangesAsync();
                
                // Добавляем зоны покрытия
                var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
                
                var zones = new[]
                {
                    new CoverageZone
                    {
                        Name = "Центральная зона",
                        Zone = CreateCirclePolygon(geometryFactory, 27.5615, 53.9006, 2000), // 2км радиус
                        RadiusMeters = 2000
                    },
                    new CoverageZone
                    {
                        Name = "Северная зона",
                        Zone = CreateCirclePolygon(geometryFactory, 27.5715, 53.9206, 1500), // 1.5км радиус
                        RadiusMeters = 1500
                    },
                    new CoverageZone
                    {
                        Name = "Южная зона",
                        Zone = CreateCirclePolygon(geometryFactory, 27.5515, 53.8806, 1800), // 1.8км радиус
                        RadiusMeters = 1800
                    }
                };

                
                context.CoverageZones.AddRange(zones);
                await context.SaveChangesAsync();
                
                logger.LogInformation("✅ Database seeded with {DroneCount} drones, {TelemetryCount} telemetry records and {ZoneCount} coverage zones", 
                    drones.Length, telemetry.Length, zones.Length);
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

// Вспомогательный метод для создания круга как полигона
static Polygon CreateCirclePolygon(GeometryFactory factory, double centerLon, double centerLat, double radiusMeters)
{
    const int segments = 32; // Количество сегментов для аппроксимации круга
    var coordinates = new Coordinate[segments + 1];
    
    // Конвертируем радиус из метров в градусы (приблизительно)
    var radiusDegrees = radiusMeters / 111000.0;
    
    for (int i = 0; i < segments; i++)
    {
        var angle = (2 * Math.PI * i) / segments;
        var x = centerLon + radiusDegrees * Math.Cos(angle);
        var y = centerLat + radiusDegrees * Math.Sin(angle);
        coordinates[i] = new Coordinate(x, y);
    }
    
    // Замыкаем полигон
    coordinates[segments] = coordinates[0];
    
    return factory.CreatePolygon(coordinates);
}

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
