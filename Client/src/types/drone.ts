// Основная модель дрона
export interface Drone {
  id: number;
  name: string;
  frequency: string;
  status: 'Active' | 'Inactive';
  lastSeen: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
}

// Телеметрия дрона
export interface Telemetry {
  id: number;
  droneId: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  timestamp: string;
}

// Зона покрытия
export interface CoverageZone {
  id: number;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
}

// Фильтры для дронов
export interface DroneFilters {
  statusFilter: string[];
  frequencyFilter: string[];
}

// Статистика дронов
export interface DroneStats {
  total: number;
  active: number;
  inactive: number;
  byFrequency: FrequencyStats[];
}

// Статистика по частотам
export interface FrequencyStats {
  frequency: string;
  count: number;
}

// Точка траектории
export interface TrajectoryPoint {
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
  timestamp: string;
}

// Данные обновления дрона через SignalR
export interface DroneUpdate {
  id: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  status: string;
  timestamp: string;
}

// Ответ от SignalR при подключении
export interface ConnectionResponse {
  connectionId: string;
  serverTime: string;
  message: string;
}

// История полётов дрона
export interface DroneHistory {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  timestamp: string;
}

// Настройки отображения карты
export interface MapSettings {
  mapType: 'osm' | 'satellite';
  showZones: boolean;
  showTrajectories: boolean;
}

// События карты
export interface MapEvent {
  type: 'centerMap' | 'resetZoom';
  detail: {
    lon?: number;
    lat?: number;
    zoom?: number;
  };
}
