# 🚁 Drone Monitoring System

Веб-приложение для мониторинга дронов в реальном времени на интерактивной карте OpenStreetMap с телеметрией, симуляцией полетов и визуализацией зон покрытия.

![Drone Monitoring Demo](demo.gif)

## ✨ Основные возможности

- 🗺️ **Интерактивная карта** — OpenLayers с отображением дронов в реальном времени
- 📊 **Телеметрия** — координаты, высота, скорость, направление, частота связи
- 📈 **Графики истории** — визуализация параметров полета с помощью Chart.js
- 🎯 **Зоны покрытия** — отображение геозон с использованием PostGIS
- 🔄 **Real-time обновления** — SignalR для мгновенной синхронизации данных
- 🤖 **Симулятор** — автоматическая генерация траекторий полетов
- 📏 **Инструменты карты** — измерение расстояний, масштабирование, управление слоями
- 🎨 **Адаптивный UI** — современный интерфейс на Tailwind CSS

## 🛠️ Технологический стек

### Backend

- **Framework**: ASP.NET Core 9.0
- **Database**: PostgreSQL 15+ с PostGIS (для геопространственных данных)
- **ORM**: Entity Framework Core 9.0
- **Real-time**: SignalR 9.0
- **Geospatial**: NetTopologySuite (NTS)

### Frontend

- **Framework**: React 19.1.1
- **Language**: TypeScript 5.9
- **Build Tool**: Vite 7.1 + SWC
- **UI**: Tailwind CSS 4.1
- **Maps**: OpenLayers 10.7 (rlayers 3.8)
- **Charts**: Chart.js 4.5 + react-chartjs-2
- **Icons**: React Icons 5.5
- **Real-time**: @microsoft/signalr 9.0

## 📦 Установка и запуск

### Требования

- .NET 9.0 SDK
- Node.js 20+ и npm
- PostgreSQL 15+ с расширением PostGIS
- Docker и Docker Compose (опционально)

### Вариант 1: Локальный запуск

#### 1. Клонировать репозиторий

```bash
git clone https://github.com/yourusername/drone-monitoring.git
cd drone-monitoring
```

#### 2. Настроить базу данных

```bash
# Создать БД PostgreSQL
createdb drone_monitoring

# Или через Docker
docker run --name drone-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=drone_monitoring -p 5432:5432 -d postgis/postgis:15-3.3
```

#### 3. Настроить переменные окружения

Создайте `.env` в корне проекта:

```env
# Backend
DATABASE_URL=Host=localhost;Database=drone_monitoring;Username=postgres;Password=postgres
PORT=5000

# Frontend
VITE_API_URL=http://localhost:5000
```

#### 4. Запустить Backend

```bash
cd Server
dotnet restore
dotnet ef database update
dotnet run
```

Backend будет доступен на `http://localhost:5000`

#### 5. Запустить Frontend

```bash
cd Client
npm install
npm run dev
```

Frontend будет доступен на `http://localhost:5173`

### Вариант 2: Docker Compose

```bash
docker-compose up --build
```

Приложение будет доступно на:

- Frontend: `http://localhost:80`
- Backend API: `http://localhost:5000`

## 📁 Структура проекта

```
drone-monitoring/
│
├── Server/                                # ASP.NET Core Backend
│   ├── Controllers/
│   │   └── DronesController.cs           # REST API endpoints
│   ├── Data/
│   │   └── ApplicationDbContext.cs       # EF Core DbContext
│   ├── Hubs/
│   │   └── DroneTrackingHub.cs           # SignalR Hub
│   ├── Services/
│   │   └── DroneSimulatorService.cs      # Фоновый сервис симуляции
│   ├── Program.cs                        # Точка входа
│   └── DroneMonitoring.Server.csproj
│
├── Client/                                # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── DroneMap.tsx              # Карта с OpenLayers
│   │   │   ├── DroneList.tsx             # Список дронов
│   │   │   ├── DroneInfoPanel.tsx        # Панель информации
│   │   │   ├── DroneHistoryPanel.tsx     # Графики телеметрии
│   │   │   ├── FilterPanel.tsx           # Фильтры
│   │   │   ├── MapControls.tsx           # Управление картой
│   │   │   ├── RulerControl.tsx          # Линейка для измерений
│   │   │   └── AboutModal.tsx            # О проекте
│   │   ├── types/
│   │   │   └── drone.ts                  # TypeScript типы
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## 🗄️ Модель данных

### Drones

```typescript
{
  id: number;
  name: string; // "Drone-001"
  frequency: string; // "2.4 GHz" | "5.8 GHz"
  status: string; // "Active" | "Inactive"
  lastSeen: DateTime;
}
```

### Telemetry

```typescript
{
  id: number;
  droneId: number;
  latitude: number; // Широта WGS84
  longitude: number; // Долгота WGS84
  altitude: number; // Высота в метрах
  speed: number; // Скорость м/с
  heading: number; // Направление 0-360°
  timestamp: DateTime;
}
```

### CoverageZones

```typescript
{
  id: number;
  name: string;
  zone: Polygon; // PostGIS геометрия
  radiusMeters: number;
}
```

## 🌐 API Endpoints

### REST API

| Method | Endpoint                            | Описание                   |
| ------ | ----------------------------------- | -------------------------- |
| `GET`  | `/api/drones`                       | Получить все дроны         |
| `GET`  | `/api/drones/{id}`                  | Получить дрон по ID        |
| `GET`  | `/api/drones/{id}/telemetry`        | История телеметрии дрона   |
| `GET`  | `/api/drones/{id}/telemetry/latest` | Последняя телеметрия       |
| `GET`  | `/api/zones`                        | Получить все зоны покрытия |
| `GET`  | `/health`                           | Health check               |

### SignalR Hub

**Endpoint**: `/droneHub`

**Events**:

- `DroneLocationUpdated` — обновление позиции дрона
- `DroneTelemetryUpdated` — обновление телеметрии
- `DroneStatusChanged` — изменение статуса

**Usage**:

```typescript
const connection = new HubConnectionBuilder()
  .withUrl("http://localhost:5000/droneHub")
  .build();

connection.on("DroneLocationUpdated", (data) => {
  console.log("Drone updated:", data);
});
```

## 🚀 Деплой

### Railway

1. Создать новый проект в Railway
2. Добавить PostgreSQL addon
3. Установить переменные окружения:
   - `DATABASE_URL` — автоматически из PostgreSQL addon
   - `FRONTEND_URL` — URL фронтенда
4. Deploy из GitHub

### Render

**Backend**:

- Build Command: `dotnet publish -c Release -o out`
- Start Command: `cd out && ./DroneMonitoring.Server`

**Frontend**:

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

## 🔧 Конфигурация

### Environment Variables

**Backend**:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
DATABASE_PRIVATE_URL=postgresql://... (Railway internal)
PORT=5000
FRONTEND_URL=http://localhost:5173
RAILWAY_PUBLIC_DOMAIN=your-app.railway.app
```

**Frontend**:

```env
VITE_API_URL=http://localhost:5000
```

## 📸 Скриншоты

> Добавьте сюда скриншоты вашего приложения

## 🤝 Contributing

Pull requests приветствуются! Для больших изменений сначала откройте issue.

## 📄 Лицензия

[MIT](LICENSE)

## 👨‍💻 Автор

Ваше имя — [GitHub](https://github.com/yourusername)

---

⭐ Если проект понравился, поставьте звезду!

```

---

## 🏷️ GitHub Metadata

**Description для GitHub** (до 350 символов):
```

Real-time drone monitoring system with interactive OpenStreetMap, telemetry visualization, and flight simulation. Built with ASP.NET Core 9.0, React 19, PostgreSQL + PostGIS, SignalR, and OpenLayers.

```

**Topics для GitHub** (рекомендую добавить):
```

drone-monitoring
real-time
aspnet-core
react
typescript
postgresql
postgis
signalr
openlayers
telemetry
geospatial
dotnet9
vite
tailwindcss
flight-tracking
webgis
mapping
fullstack
csharp
entity-framework-core
