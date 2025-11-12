using DroneMonitoring.Server.Data;
using DroneMonitoring.Server.Hubs;
using DroneMonitoring.Server.Services;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();

// ===== ИЗМЕНЕНО: Единая конфигурация БД, которая работает везде =====
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    string connectionString;
    // В первую очередь пытаемся получить строку из переменных окружения (для Railway)
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    
    if (!string.IsNullOrEmpty(databaseUrl))
    {
        connectionString = ConvertUriToConnectionString(databaseUrl);
        Console.WriteLine("📊 Using DATABASE_URL for production environment.");
    }
    else
    {
        // Если переменных нет, берем строку из appsettings.json (для локальной разработки)
        connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
        Console.WriteLine("📊 Using 'DefaultConnection' from appsettings for development.");
    }
    
    options.UseNpgsql(connectionString, x => x.UseNetTopologySuite());
});

// SignalR для real-time
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// Фоновый сервис симуляции дронов
builder.Services.AddHostedService<DroneSimulatorService>();

// ===== ИЗМЕНЕНО: Единая конфигурация CORS =====
builder.Services.AddCors(options =>
{
    options.AddPolicy("AppCors", policy =>
    {
        // Для Production берем URL из переменных окружения
        var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:5173";
        
        var allowedOrigins = new List<string> { frontendUrl };
        
        // Для Development всегда добавляем localhost
        if (builder.Environment.IsDevelopment())
        {
            allowedOrigins.Add("http://localhost:5173");
            allowedOrigins.Add("https://localhost:5173");
        }
        
        policy.WithOrigins(allowedOrigins.Distinct().ToArray())
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
        
        Console.WriteLine($"🌐 Allowed CORS Origins: {string.Join(", ", allowedOrigins.Distinct())}");
    });
});


var app = builder.Build();

// Используем CORS для всех окружений
app.UseCors("AppCors");

// ===== ИЗМЕНЕНО: Конфигурация пайплайна в зависимости от окружения =====
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    // HTTPS Redirection включаем только НЕ в Development (Railway сам управляет SSL)
    app.UseHttpsRedirection();
}

app.MapControllers();
app.MapHub<DroneTrackingHub>("/droneHub");

// Health check для Railway
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

// ===== ИЗМЕНЕНО: Инициализация БД в зависимости от окружения =====
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();

        if (app.Environment.IsDevelopment())
        {
            // Для разработки: всегда пересоздаем БД для чистого старта
            logger.LogInformation("Development environment detected. Recreating database...");
            await context.Database.EnsureDeletedAsync();
            await context.Database.EnsureCreatedAsync();
            await SeedDatabase(context, logger); // Наполняем данными
        }
        else
        {
            // Для Production: применяем миграции. Если их нет, просто создаем БД.
            // TODO: В будущем здесь будет context.Database.MigrateAsync();
            logger.LogInformation("Production environment detected. Ensuring database is created...");
            await context.Database.EnsureCreatedAsync();
            await SeedDatabase(context, logger); // Наполняем данными, если БД пустая
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred during database initialization.");
    }
}

app.Run();


// ===== Вспомогательные методы остались без изменений, но вынесены в конец =====

async Task SeedDatabase(ApplicationDbContext context, ILogger<Program> logger)
{
    if (await context.Drones.AnyAsync())
    {
        logger.LogInformation("Database already contains data, skipping seed.");
        return;
    }

    logger.LogInformation("Seeding database with initial data...");
    
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
    
    var geometryFactory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
    var zones = new[]
    {
        new CoverageZone { Name = "Центральная зона", Zone = CreateGeodesicCirclePolygon(geometryFactory, 27.5618, 53.9022, 2500), RadiusMeters = 2500 },
        new CoverageZone { Name = "Северная зона", Zone = CreateGeodesicCirclePolygon(geometryFactory, 27.6830, 53.9350, 2000), RadiusMeters = 2000 },
        new CoverageZone { Name = "Южная зона", Zone = CreateGeodesicCirclePolygon(geometryFactory, 27.6050, 53.8455, 3000), RadiusMeters = 3000 }
    };
    context.CoverageZones.AddRange(zones);

    await context.SaveChangesAsync();
    logger.LogInformation("✅ Database seeded successfully.");
}

string ConvertUriToConnectionString(string databaseUrl)
{
    if (!databaseUrl.StartsWith("postgres://") && !databaseUrl.StartsWith("postgresql://")) return databaseUrl;
    var uri = new Uri(databaseUrl.Replace("postgres://", "postgresql://"));
    var host = uri.Host;
    var port = uri.Port > 0 ? uri.Port : 5432;
    var database = uri.AbsolutePath.TrimStart('/');
    var userInfo = uri.UserInfo.Split(':');
    var username = userInfo[0];
    var password = userInfo[1];
    var connectionString = $"Host={host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";
    return connectionString;
}

Polygon CreateGeodesicCirclePolygon(GeometryFactory factory, double centerLon, double centerLat, double radiusMeters)
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