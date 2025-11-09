# Drone Monitoring System - Проектная документация

## 📋 Описание

Веб-приложение для мониторинга дронов на интерактивной карте. Pet-project для демонстрации современного full-stack подхода с .NET и React.

**Текущий функционал:**

- Отображение дронов на карте OpenStreetMap
- Просмотр телеметрии (координаты, высота, скорость, частота)
- REST API для получения данных
- Обновление данных каждые 5 секунд
- Панель информации о дронах

---

## 🛠 Технологический стек

### Backend

- **Framework**: ASP.NET Core 9.0
- **ORM**: Entity Framework Core 9.0
- **Database**: PostgreSQL 15+
- **Real-time**: SignalR (подключен, но не используется пока)

**NuGet пакеты:**

```xml
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="9.0.0" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="9.0.0" />
```

### Frontend

- **Framework**: React 19.1.1
- **Language**: TypeScript ~5.9.3
- **Build Tool**: Vite ^7.1.7 с SWC compiler
- **UI Framework**: Tailwind CSS 4.1.17
- **Maps Library**: OpenLayers ^10.7.0 (rlayers ^3.8.0 — React обёртка)
- **HTTP Client**: Fetch API (нативный)
- **Real-time Client**: @microsoft/signalr ^8.0.0 (установлен, не используется)

**npm пакеты:**

```json
{
  "dependencies": {
    "@microsoft/signalr": "^8.0.0",
    "@tailwindcss/vite": "^4.1.17",
    "ol": "^10.7.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "rlayers": "^3.8.0",
    "tailwindcss": "^4.1.17"
  },
  "devDependencies": {
    "@types/node": "^24.6.0",
    "@types/react": "^19.1.16",
    "@types/react-dom": "^19.1.9",
    "@vitejs/plugin-react-swc": "^4.1.0",
    "typescript": "~5.9.3",
    "vite": "^7.1.7"
  }
}
```

### Development

- **IDE**: Visual Studio Code
- **Package Managers**: dotnet CLI, npm

---

## 📁 Структура проекта

```
DroneMonitoringWeb/
│
├── Client/                           # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── Map/
│   │   │       └── DroneMap.tsx     # Компонент карты
│   │   ├── services/
│   │   │   └── api.ts               # REST API клиент
│   │   ├── types/
│   │   │   └── drone.ts             # TypeScript интерфейсы
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── vite.config.ts               # Vite + proxy конфигурация
│   ├── tsconfig.json
│   └── package.json
│
├── Server/                           # ASP.NET Core Backend
│   ├── Controllers/
│   │   └── DronesController.cs      # REST API endpoints
│   ├── Data/
│   │   └── ApplicationDbContext.cs  # EF Core DbContext + Entity модели
│   ├── Hubs/
│   │   └── DroneTrackingHub.cs      # SignalR Hub (базовый)
│   ├── Program.cs                   # Entry point
│   ├── appsettings.json             # ConnectionString
│   └── DroneMonitoring.Server.csproj
│
└── DroneMonitoring.sln
```

---

## 🗄️ Модель данных

### Структура БД (PostgreSQL)

**Drones** — информация о дронах

```csharp
public class Drone
{
    public int Id { get; set; }
    public string Name { get; set; }          // "Drone-001"
    public string Frequency { get; set; }     // "2.4 GHz", "5.8 GHz"
    public DateTime LastSeen { get; set; }
    public string Status { get; set; }        // "Active", "Inactive"
}
```

**Telemetry** — телеметрия полётов

```csharp
public class Telemetry
{
    public int Id { get; set; }
    public int DroneId { get; set; }
    public Drone Drone { get; set; }

    public double Latitude { get; set; }      // Широта (WGS84)
    public double Longitude { get; set; }     // Долгота (WGS84)
    public double Altitude { get; set; }      // Высота (метры)
    public double Speed { get; set; }         // Скорость (м/с)
    public double Heading { get; set; }       // Направление (градусы 0-360)
    public DateTime Timestamp { get; set; }
}
```

**CoverageZones** — зоны покрытия (не используется пока)

```csharp
public class CoverageZone
{
    public int Id { get; set; }
    public string Name { get; set; }
    public double CenterLatitude { get; set; }
    public double CenterLongitude { get; set; }
    public int RadiusMeters { get; set; }
}
```

---
