import React, { useEffect, useState, useRef, useCallback } from "react";
import { Map, View } from "ol";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { XYZ } from "ol/source";
import { Vector as VectorSource } from "ol/source";
import { Feature } from "ol";
import { Point, LineString, Circle as CircleGeom } from "ol/geom";
import {
  Style,
  Icon,
  Stroke,
  Fill,
  Text,
  Circle as CircleStyle,
} from "ol/style";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls } from "ol/control"; // ✅ ИСПРАВЛЕНИЕ #2
import * as signalR from "@microsoft/signalr";
import type {
  Drone,
  DroneFilters,
  CoverageZone,
  DroneStats,
} from "../../types/drone";
import type { FeatureLike } from "ol/Feature";
import { DroneInfoPanel } from "../DroneInfoPanel";
import { FilterPanel } from "./../FilterPanel";
import { MapControls } from "./../MapControls";
import { DroneList } from "../DroneList";
import { DroneHistoryPanel } from "../DroneHistoryPanel";

// Компонент Tooltip для дронов
const DroneTooltip: React.FC<{
  drone: Drone;
  x: number;
  y: number;
}> = ({ drone, x, y }) => {
  return (
    <div
      className="drone-tooltip"
      style={{
        left: `${x + 15}px`,
        top: `${y + 15}px`,
      }}
    >
      <div className="font-bold text-green-400 mb-1 tech-font flex items-center">
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
        {drone.name}
      </div>
      <div
        className={`text-xs mb-2 ${
          drone.status === "Active"
            ? "text-green-400 status-active"
            : "text-red-400"
        }`}
      >
        ● {drone.status === "Active" ? "АКТИВЕН" : "НЕАКТИВЕН"}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-400">Высота:</span>
          <span className="ml-1 text-white tech-font">
            {drone.altitude.toFixed(0)}м
          </span>
        </div>
        <div>
          <span className="text-gray-400">Скорость:</span>
          <span className="ml-1 text-white tech-font">
            {drone.speed.toFixed(1)}м/с
          </span>
        </div>
        <div>
          <span className="text-gray-400">Курс:</span>
          <span className="ml-1 text-white tech-font">
            {drone.heading.toFixed(0)}°
          </span>
        </div>
        <div>
          <span className="text-gray-400">Частота:</span>
          <span className="ml-1 text-white tech-font">{drone.frequency}</span>
        </div>
      </div>
    </div>
  );
};

export const DroneMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const droneLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const zoneLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const trajectoryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

  // ✅ Используем ref для актуального состояния дронов в обработчиках
  const dronesRef = useRef<Drone[]>([]);
  const zonesRef = useRef<CoverageZone[]>([]);

  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [filters, setFilters] = useState<DroneFilters>({
    statusFilter: [],
    frequencyFilter: [],
  });
  const [stats, setStats] = useState<DroneStats | null>(null);
  const [zones, setZones] = useState<CoverageZone[]>([]);
  const [showZones, setShowZones] = useState(true);
  const [showTrajectories, setShowTrajectories] = useState(true);
  const [mapType, setMapType] = useState<"osm" | "satellite">("osm");
  const [isConnected, setIsConnected] = useState(false);
  const [showDroneList, setShowDroneList] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDroneId, setHistoryDroneId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    drone: Drone;
    x: number;
    y: number;
  } | null>(null);

  // ✅ ИСПРАВЛЕНИЕ #4: Отслеживание ID дрона с отображаемой траекторией
  const [displayedTrajectoryDroneId, setDisplayedTrajectoryDroneId] = useState<
    number | null
  >(null);

  // ✅ Обновляем ref при изменении drones и zones
  useEffect(() => {
    dronesRef.current = drones;
  }, [drones]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  // ✅ Функция проверки, находится ли дрон в зоне покрытия
  const isDroneInAnyZone = useCallback((drone: Drone): boolean => {
    if (zonesRef.current.length === 0) return true;

    for (const zone of zonesRef.current) {
      const dx = zone.centerLon - drone.longitude;
      const dy = zone.centerLat - drone.latitude;
      const distanceKm = Math.sqrt(dx * dx + dy * dy) * 111;

      if (distanceKm * 1000 <= zone.radiusMeters) {
        return true;
      }
    }
    return false;
  }, []);

  // Инициализация карты - ТОЛЬКО ОДИН РАЗ
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    console.log("🗺️ Initializing map...");

    // Создаём слои
    const droneSource = new VectorSource();
    const droneLayer = new VectorLayer({
      source: droneSource,
      style: createDroneStyle,
      zIndex: 100,
    });
    droneLayerRef.current = droneLayer;

    const zoneSource = new VectorSource();
    const zoneLayer = new VectorLayer({
      source: zoneSource,
      style: createZoneStyle,
      zIndex: 50,
      opacity: 0.7,
    });
    zoneLayerRef.current = zoneLayer;

    const trajectorySource = new VectorSource();
    const trajectoryLayer = new VectorLayer({
      source: trajectorySource,
      style: createTrajectoryStyle,
      zIndex: 60,
    });
    trajectoryLayerRef.current = trajectoryLayer;

    // ✅ Тёмная карта под стиль проекта
    const darkTileLayer = new TileLayer({
      source: new XYZ({
        url: "https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        attributions: "© OpenStreetMap contributors, © CartoDB",
      }),
    });

    // ✅ ИСПРАВЛЕНИЕ #2: Скрываем стандартные контролы, используем свои
    const map = new Map({
      target: mapRef.current,
      layers: [darkTileLayer, zoneLayer, trajectoryLayer, droneLayer],
      view: new View({
        center: fromLonLat([27.5615, 53.9006]),
        zoom: 12,
      }),
    });

    mapInstanceRef.current = map;

    console.log("✅ Map initialized at Minsk:", [27.5615, 53.9006]);

    setTimeout(() => {
      if (map) {
        map.updateSize();
        console.log("🔄 Map size updated");
      }
    }, 100);

    // ✅ Обработка кликов с использованием ref
    map.on("click", (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f, {
        layerFilter: (layer) => layer === droneLayer,
      });

      if (feature && feature.get("type") === "drone") {
        const droneId = feature.get("droneId");
        const drone = dronesRef.current.find((d) => d.id === droneId);
        if (drone) {
          console.log("🎯 Drone clicked:", drone.name);
          setSelectedDrone(drone);
          setDisplayedTrajectoryDroneId(droneId); // ✅ Устанавливаем ID отображаемой траектории
          loadDroneTrajectory(droneId);

          const view = map.getView();
          view.animate({
            center: fromLonLat([drone.longitude, drone.latitude]),
            duration: 500,
          });
        }
      }
      setTooltip(null);
    });

    // ✅ Изменение курсора и показ tooltip с использованием ref
    map.on("pointermove", (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f, {
        layerFilter: (layer) => layer === droneLayer,
      });

      if (feature && feature.get("type") === "drone") {
        map.getTargetElement().style.cursor = "pointer";

        const droneId = feature.get("droneId");
        const drone = dronesRef.current.find((d) => d.id === droneId);

        if (drone) {
          setTooltip({
            drone,
            x: event.pixel[0],
            y: event.pixel[1],
          });
        }
      } else {
        map.getTargetElement().style.cursor = "";
        setTooltip(null);
      }
    });

    return () => {
      console.log("🧹 Cleaning up map...");
      if (map) {
        map.setTarget(undefined);
        map.dispose();
      }
    };
  }, []); // ✅ Пустой массив - карта создается только один раз!

  // ✅ Анимация ТОЛЬКО для зон покрытия через JavaScript
  useEffect(() => {
    if (!zoneLayerRef.current) return;

    let animationFrame: number;
    let phase = 0;

    const animateZones = () => {
      const source = zoneLayerRef.current?.getSource();
      if (!source) return;

      const opacity = 0.65 + Math.sin(phase) * 0.15;
      zoneLayerRef.current?.setOpacity(opacity);

      phase += 0.02;
      animationFrame = requestAnimationFrame(animateZones);
    };

    animateZones();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  // Инициализация SignalR соединения
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5216/droneHub")
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connectionRef.current = connection;

    connection.on("Connected", (data) => {
      console.log("📡 Connected to DroneHub:", data);
      setIsConnected(true);
    });

    connection.on("InitialDronesState", (dronesData: any[]) => {
      console.log("🚁 Received initial drones:", dronesData);
      const mappedDrones = dronesData.map((d) => ({
        id: d.id,
        name: d.name,
        frequency: d.frequency,
        status: d.status,
        lastSeen: d.lastSeen,
        latitude: d.currentPosition?.latitude || 0,
        longitude: d.currentPosition?.longitude || 0,
        altitude: d.currentPosition?.altitude || 0,
        speed: d.currentPosition?.speed || 0,
        heading: d.currentPosition?.heading || 0,
      }));
      setDrones(mappedDrones);
    });

    // ✅ ИСПРАВЛЕНИЕ #1 и #3: Обновляем дронов И автоматически перезагружаем траекторию
    connection.on("DronesUpdated", (updates: any[]) => {
      console.log("🔄 Drones updated:", updates);

      setDrones((prevDrones) => {
        const updatedDrones = prevDrones.map((drone) => {
          const update = updates.find((u) => u.id === drone.id);
          if (update) {
            return {
              ...drone,
              latitude: update.latitude,
              longitude: update.longitude,
              altitude: update.altitude,
              speed: update.speed,
              heading: update.heading,
              status: update.status,
              lastSeen: update.timestamp,
            };
          }
          return drone;
        });
        return updatedDrones;
      });

      // ✅ ИСПРАВЛЕНИЕ #1 и #3: Автоматическое обновление траектории выбранного дрона
      setDisplayedTrajectoryDroneId((prevId) => {
        if (
          prevId !== null &&
          connectionRef.current?.state === signalR.HubConnectionState.Connected
        ) {
          // Небольшая задержка для того, чтобы данные успели сохраниться в БД
          setTimeout(() => {
            connectionRef.current?.invoke("GetDroneTrajectory", prevId, 1);
            console.log("🔄 Auto-reloading trajectory for drone:", prevId);
          }, 200);
        }
        return prevId;
      });
    });

    connection.on("CoverageZones", (zonesData: any[]) => {
      console.log("🛡️ Received coverage zones:", zonesData);
      setZones(zonesData);
      updateZoneFeatures(zonesData);
    });

    connection.on("DroneStatistics", (statsData: any) => {
      console.log("📊 Received statistics:", statsData);
      setStats(statsData);
    });

    connection.on("DroneTrajectory", (data: any) => {
      console.log("📈 Received trajectory for drone", data.droneId);
      if (data.points && data.points.length > 0) {
        displayTrajectory(data.droneId, data.points);
      }
    });

    connection.onreconnecting(() => {
      console.log("🔄 Reconnecting...");
      setIsConnected(false);
    });

    connection.onreconnected(() => {
      console.log("✅ Reconnected");
      setIsConnected(true);
    });

    connection
      .start()
      .then(() => {
        console.log("✅ SignalR connection established");
      })
      .catch((err) => {
        console.error("❌ SignalR connection failed:", err);
      });

    return () => {
      connection.stop();
    };
  }, []);

  // ✅ Функция для загрузки траектории (вынесена наружу)
  const loadDroneTrajectory = useCallback((droneId: number) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      connectionRef.current.invoke("GetDroneTrajectory", droneId, 1);
      console.log("📡 Loading trajectory for drone:", droneId);
    }
  }, []);

  // ✅ ИСПРАВЛЕНИЕ #2: Обновление дронов БЕЗ очистки траекторий
  const updateDroneFeatures = useCallback(
    (dronesData: Drone[]) => {
      if (!droneLayerRef.current) return;

      const source = droneLayerRef.current.getSource();
      if (!source) return;

      console.log(`🔍 Updating ${dronesData.length} drones on map`);

      // ✅ Применяем фильтры правильно И проверяем нахождение в зонах
      const filteredDrones = dronesData.filter((drone) => {
        const statusMatch =
          filters.statusFilter.length === 0 ||
          filters.statusFilter.includes(drone.status);
        const frequencyMatch =
          filters.frequencyFilter.length === 0 ||
          filters.frequencyFilter.includes(drone.frequency);

        const inZone = isDroneInAnyZone(drone);

        return statusMatch && frequencyMatch && inZone;
      });

      console.log(
        `✅ Displaying ${filteredDrones.length} filtered drones (in zones)`
      );

      // ✅ Обновляем существующие features вместо пересоздания
      const existingFeatures = source.getFeatures();
      const existingIds = new Set(
        existingFeatures.map((f) => f.get("droneId"))
      );
      const newIds = new Set(filteredDrones.map((d) => d.id));

      // Удаляем features для дронов, которых больше нет в фильтрованном списке
      existingFeatures.forEach((feature) => {
        const droneId = feature.get("droneId");
        if (!newIds.has(droneId)) {
          source.removeFeature(feature);
        }
      });

      // Обновляем или добавляем features
      filteredDrones.forEach((drone) => {
        const existingFeature = existingFeatures.find(
          (f) => f.get("droneId") === drone.id
        );

        if (existingFeature) {
          // Обновляем существующий feature
          const geometry = existingFeature.getGeometry() as Point;
          geometry.setCoordinates(
            fromLonLat([drone.longitude, drone.latitude])
          );
          existingFeature.set("status", drone.status);
          existingFeature.set("altitude", drone.altitude);
          existingFeature.set("speed", drone.speed);
          existingFeature.set("heading", drone.heading);
        } else {
          // Создаём новый feature
          const feature = new Feature({
            geometry: new Point(fromLonLat([drone.longitude, drone.latitude])),
            type: "drone",
            droneId: drone.id,
            name: drone.name,
            status: drone.status,
            altitude: drone.altitude,
            speed: drone.speed,
            heading: drone.heading,
          });
          source.addFeature(feature);
        }
      });
    },
    [filters, isDroneInAnyZone]
  );

  // ✅ Функция очистки всех траекторий
  const clearAllTrajectories = useCallback(() => {
    if (!trajectoryLayerRef.current) return;
    const source = trajectoryLayerRef.current.getSource();
    if (source) {
      source.clear();
      setDisplayedTrajectoryDroneId(null);
      console.log("🧹 All trajectories cleared");
    }
  }, []);

  // ✅ Обновление дронов БЕЗ очистки траекторий
  useEffect(() => {
    console.log("🔄 Drones updated, refreshing map");
    updateDroneFeatures(drones);
  }, [drones, updateDroneFeatures]);

  // ✅ ИСПРАВЛЕНИЕ #4: Умная логика управления траекториями при изменении фильтров
  useEffect(() => {
    console.log("🔍 Filters changed, checking trajectory visibility");

    // Проверяем, виден ли выбранный дрон с текущими фильтрами
    if (displayedTrajectoryDroneId !== null) {
      const selectedDroneData = drones.find(
        (d) => d.id === displayedTrajectoryDroneId
      );

      if (selectedDroneData) {
        // Проверяем, проходит ли дрон фильтры
        const statusMatch =
          filters.statusFilter.length === 0 ||
          filters.statusFilter.includes(selectedDroneData.status);
        const frequencyMatch =
          filters.frequencyFilter.length === 0 ||
          filters.frequencyFilter.includes(selectedDroneData.frequency);
        const inZone = isDroneInAnyZone(selectedDroneData);

        // ✅ ИСПРАВЛЕНИЕ #4: Удаляем траекторию только если дрон не проходит фильтры
        if (!statusMatch || !frequencyMatch || !inZone) {
          console.log("🧹 Selected drone filtered out, clearing trajectory");
          clearAllTrajectories();
          setSelectedDrone(null);
        } else {
          console.log("✅ Selected drone still visible, keeping trajectory");
          // Траектория остается, ничего не делаем
        }
      } else {
        // Дрон не найден в списке - удаляем траекторию
        clearAllTrajectories();
        setSelectedDrone(null);
      }
    }
  }, [
    filters,
    displayedTrajectoryDroneId,
    drones,
    isDroneInAnyZone,
    clearAllTrajectories,
  ]);

  // Обновление зон покрытия
  const updateZoneFeatures = (zones: CoverageZone[]) => {
    if (!zoneLayerRef.current) return;

    const source = zoneLayerRef.current.getSource();
    if (!source) return;

    source.clear();

    console.log(`🛡️ Updating ${zones.length} coverage zones`);

    zones.forEach((zone) => {
      const center = fromLonLat([zone.centerLon, zone.centerLat]);
      const feature = new Feature({
        geometry: new CircleGeom(center, zone.radiusMeters),
        type: "zone",
        zoneId: zone.id,
        name: zone.name,
      });
      source.addFeature(feature);
    });
  };

  // ✅ Отображение траектории (удаляет все старые)
  const displayTrajectory = (droneId: number, points: any[]) => {
    if (!trajectoryLayerRef.current) return;

    const source = trajectoryLayerRef.current.getSource();
    if (!source) return;

    // ✅ Удаляем ВСЕ траектории перед добавлением новой
    source.clear();

    if (points.length < 2) return;

    const coordinates = points.map((p) => fromLonLat([p.lon, p.lat]));
    const lineFeature = new Feature({
      geometry: new LineString(coordinates),
      type: "trajectory",
      droneId: droneId,
    });

    source.addFeature(lineFeature);
    console.log(
      `✅ Trajectory displayed for drone ${droneId} with ${points.length} points`
    );
  };

  // ✅ Применение фильтров
  const applyFilters = (newFilters: DroneFilters) => {
    console.log("✅ Applying new filters:", newFilters);
    setFilters(newFilters);
    // Очистка траекторий произойдёт автоматически через useEffect
  };

  // Переключение типа карты
  const toggleMapType = () => {
    if (!mapInstanceRef.current) return;

    const newType = mapType === "osm" ? "satellite" : "osm";
    setMapType(newType);

    const layers = mapInstanceRef.current.getLayers();
    const baseLayer = layers.item(0) as TileLayer<any>;

    if (newType === "satellite") {
      baseLayer.setSource(
        new XYZ({
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          attributions: "Tiles © Esri",
        })
      );
    } else {
      baseLayer.setSource(
        new XYZ({
          url: "https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          attributions: "© OpenStreetMap contributors, © CartoDB",
        })
      );
    }
  };

  // Переключение видимости слоёв
  useEffect(() => {
    if (zoneLayerRef.current) {
      zoneLayerRef.current.setVisible(showZones);
    }
  }, [showZones]);

  useEffect(() => {
    if (trajectoryLayerRef.current) {
      trajectoryLayerRef.current.setVisible(showTrajectories);
    }
  }, [showTrajectories]);

  // Обработчик выбора дрона
  const handleDroneSelect = (drone: Drone) => {
    console.log("🔍 Drone selected from list:", drone.name);
    setSelectedDrone(drone);
    setDisplayedTrajectoryDroneId(drone.id); // ✅ Устанавливаем ID отображаемой траектории
    loadDroneTrajectory(drone.id);
    if (mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({
        center: fromLonLat([drone.longitude, drone.latitude]),
        zoom: 14,
        duration: 500,
      });
    }
  };

  // Обработчик отслеживания дрона
  const handleDroneTrack = (droneId: number) => {
    const drone = drones.find((d) => d.id === droneId);
    if (drone && mapInstanceRef.current) {
      const view = mapInstanceRef.current.getView();
      view.animate({
        center: fromLonLat([drone.longitude, drone.latitude]),
        zoom: 14,
        duration: 500,
      });
      setSelectedDrone(drone);
      setDisplayedTrajectoryDroneId(droneId); // ✅ Устанавливаем ID отображаемой траектории
      loadDroneTrajectory(droneId);
    }
  };

  // ✅ Обработчики для кнопок карты
  const handleCenterMap = () => {
    if (!mapInstanceRef.current) return;
    const view = mapInstanceRef.current.getView();
    view.animate({
      center: fromLonLat([27.5615, 53.9006]), // Минск
      duration: 500,
    });
  };

  const handleResetZoom = () => {
    if (!mapInstanceRef.current) return;
    const view = mapInstanceRef.current.getView();
    view.animate({
      zoom: 12,
      duration: 500,
    });
  };

  return (
    <div className="flex h-screen bg-gray-900 military-grid">
      {/* Левая панель с фильтрами */}
      <FilterPanel
        filters={filters}
        onFiltersChange={applyFilters}
        stats={stats}
        isConnected={isConnected}
      />

      {/* Основная область карты */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* Tooltip при наведении */}
        {tooltip && (
          <DroneTooltip drone={tooltip.drone} x={tooltip.x} y={tooltip.y} />
        )}

        {/* Контролы карты - ✅ ИСПРАВЛЕНИЕ #2: Размещены справа, не перекрывают стандартные контролы */}
        <MapControls
          mapType={mapType}
          showZones={showZones}
          showTrajectories={showTrajectories}
          onToggleMapType={toggleMapType}
          onToggleZones={() => setShowZones(!showZones)}
          onToggleTrajectories={() => setShowTrajectories(!showTrajectories)}
          onCenterMap={handleCenterMap}
          onResetZoom={handleResetZoom}
        />

        {/* Панель информации о выбранном дроне */}
        {selectedDrone && (
          <DroneInfoPanel
            drone={selectedDrone}
            onClose={() => {
              setSelectedDrone(null);
              clearAllTrajectories();
            }}
          />
        )}

        {/* Кнопка переключения списка дронов */}
        <button
          onClick={() => setShowDroneList(!showDroneList)}
          className="absolute top-4 right-4 military-button p-3 rounded-lg text-green-400 hover:text-white z-10"
          title={showDroneList ? "Скрыть список" : "Показать список"}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Правая панель со списком дронов */}
      {showDroneList && (
        <div className="w-96 h-full">
          <DroneList
            drones={drones}
            selectedDrone={selectedDrone}
            onDroneSelect={handleDroneSelect}
            onDroneTrack={handleDroneTrack}
          />
        </div>
      )}

      {/* Панель истории дронов */}
      {showHistory && historyDroneId && (
        <DroneHistoryPanel
          droneId={historyDroneId}
          droneName={
            drones.find((d) => d.id === historyDroneId)?.name ||
            `Drone-${historyDroneId}`
          }
          onClose={() => {
            setShowHistory(false);
            setHistoryDroneId(null);
          }}
        />
      )}
    </div>
  );
};

// ✅ Стили для дронов
function createDroneStyle(feature: FeatureLike): Style {
  const status = feature.get("status") as string;
  const name = feature.get("name") as string;
  const altitude = feature.get("altitude") as number;
  const speed = feature.get("speed") as number;

  const color = status === "Active" ? "#22c55e" : "#ef4444";

  return new Style({
    image: new CircleStyle({
      radius: 10,
      fill: new Fill({ color: color }),
      stroke: new Stroke({
        color: "#ffffff",
        width: 2,
      }),
    }),
    text: new Text({
      text: `${name}\n${altitude?.toFixed(0) || 0}m\n${
        speed?.toFixed(1) || 0
      }m/s`,
      offsetY: -25,
      font: "bold 11px 'Courier New', monospace",
      fill: new Fill({ color: color }),
      stroke: new Stroke({
        color: "#000000",
        width: 4,
      }),
      backgroundFill: new Fill({
        color: "rgba(0, 0, 0, 0.8)",
      }),
      padding: [4, 6, 4, 6],
    }),
  });
}

// ✅ Стили для зон покрытия с обводкой текста
function createZoneStyle(feature: FeatureLike): Style {
  const name = feature.get("name") as string;

  return new Style({
    fill: new Fill({
      color: "rgba(34, 197, 94, 0.15)",
    }),
    stroke: new Stroke({
      color: "rgba(34, 197, 94, 0.9)",
      width: 4,
    }),
    text: new Text({
      text: name || "ЗОНА",
      font: "bold 16px 'Courier New', monospace",
      fill: new Fill({ color: "#22c55e" }),
      stroke: new Stroke({
        color: "#000000",
        width: 5,
      }),
      backgroundFill: new Fill({
        color: "rgba(0, 0, 0, 0.9)",
      }),
      padding: [8, 12, 8, 12],
    }),
  });
}

// ✅ Стили для траекторий
function createTrajectoryStyle(feature: FeatureLike): Style {
  return new Style({
    stroke: new Stroke({
      color: "rgba(251, 191, 36, 0.8)",
      width: 3,
      lineCap: "round",
      lineJoin: "round",
    }),
  });
}
