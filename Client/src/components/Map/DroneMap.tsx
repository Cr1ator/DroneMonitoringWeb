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
import { defaults as defaultControls } from "ol/control";
import * as signalR from "@microsoft/signalr";
import { TbDrone } from "react-icons/tb";
import { GiRadioactive } from "react-icons/gi";
import { MdWarning } from "react-icons/md";
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
        <TbDrone className="w-4 h-4 mr-1" />
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

// Простая панель тревоги БЕЗ звука
const AlarmPanel: React.FC<{
  dronesInZones: number;
  onDismiss: () => void;
}> = ({ dronesInZones, onDismiss }) => {
  if (dronesInZones === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="military-panel border-2 border-red-500 bg-red-900/90 px-6 py-3 rounded-lg shadow-2xl animate-pulse">
        <div className="flex items-center space-x-4">
          <GiRadioactive className="w-8 h-8 text-red-400 animate-spin" />
          <div>
            <div className="text-red-200 font-bold text-lg">ТРЕВОГА!</div>
            <div className="text-red-300 text-sm">
              Обнаружено {dronesInZones} дрон(ов) в зоне
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="military-button p-2 rounded text-red-400 hover:text-white"
            title="Закрыть"
          >
            <MdWarning className="w-5 h-5" />
          </button>
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

  const dronesRef = useRef<Drone[]>([]);
  const zonesRef = useRef<CoverageZone[]>([]);
  const dronesInZonesRef = useRef<Set<number>>(new Set()); // Отслеживаем дронов в зонах

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
  const [displayedTrajectoryDroneId, setDisplayedTrajectoryDroneId] = useState<
    number | null
  >(null);

  // Состояние для тревоги
  const [showAlarm, setShowAlarm] = useState(false);
  const [dronesInZonesCount, setDronesInZonesCount] = useState(0);

  useEffect(() => {
    dronesRef.current = drones;
  }, [drones]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  // Проверка дронов в зонах
  const isDroneInAnyZone = useCallback((drone: Drone): boolean => {
    if (zonesRef.current.length === 0) return false;

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

  // Подсчет дронов в зонах и автоматическая загрузка траекторий
  useEffect(() => {
    const activeDronesInZones = drones.filter(
      (d) => d.status === "Active" && isDroneInAnyZone(d)
    );
    const count = activeDronesInZones.length;
    setDronesInZonesCount(count);

    if (count > 0) {
      setShowAlarm(true);

      // НОВОЕ: Автоматически загружаем траектории для новых дронов в зонах
      activeDronesInZones.forEach((drone) => {
        if (!dronesInZonesRef.current.has(drone.id)) {
          console.log(
            `🛸 Новый дрон в зоне: ${drone.name}, загружаем траекторию`
          );
          dronesInZonesRef.current.add(drone.id);

          // Загружаем траекторию для нового дрона в зоне
          if (
            connectionRef.current?.state ===
            signalR.HubConnectionState.Connected
          ) {
            connectionRef.current.invoke("GetDroneTrajectory", drone.id, 1);
          }
        }
      });

      // Удаляем дронов которые вышли из зон
      const currentIds = new Set(activeDronesInZones.map((d) => d.id));
      dronesInZonesRef.current.forEach((id) => {
        if (!currentIds.has(id)) {
          console.log(`🛸 Дрон ${id} вышел из зоны`);
          dronesInZonesRef.current.delete(id);
        }
      });
    } else {
      dronesInZonesRef.current.clear();
    }
  }, [drones, isDroneInAnyZone]);

  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    console.log("🗺️ Initializing map...");

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

    const darkTileLayer = new TileLayer({
      source: new XYZ({
        url: "https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        attributions: "© OpenStreetMap contributors, © CartoDB",
      }),
    });

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
          setDisplayedTrajectoryDroneId(droneId);
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
  }, []);

  // Анимация зон
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

  // SignalR подключение - ИСПРАВЛЕНО: InitialDronesState
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

    // ИСПРАВЛЕНО: InitialDronesState вместо InitialDrones
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

      setDisplayedTrajectoryDroneId((prevId) => {
        if (
          prevId !== null &&
          connectionRef.current?.state === signalR.HubConnectionState.Connected
        ) {
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

  const loadDroneTrajectory = useCallback((droneId: number) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      connectionRef.current.invoke("GetDroneTrajectory", droneId, 1);
      console.log("📡 Loading trajectory for drone:", droneId);
    }
  }, []);

  const updateDroneFeatures = useCallback(
    (dronesData: Drone[]) => {
      if (!droneLayerRef.current) return;

      const source = droneLayerRef.current.getSource();
      if (!source) return;

      console.log(`🔍 Updating ${dronesData.length} drones on map`);

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

      const existingFeatures = source.getFeatures();
      const existingIds = new Set(
        existingFeatures.map((f) => f.get("droneId"))
      );
      const newIds = new Set(filteredDrones.map((d) => d.id));

      existingFeatures.forEach((feature) => {
        const droneId = feature.get("droneId");
        if (!newIds.has(droneId)) {
          source.removeFeature(feature);
        }
      });

      filteredDrones.forEach((drone) => {
        const existingFeature = existingFeatures.find(
          (f) => f.get("droneId") === drone.id
        );

        if (existingFeature) {
          const geometry = existingFeature.getGeometry() as Point;
          geometry.setCoordinates(
            fromLonLat([drone.longitude, drone.latitude])
          );

          existingFeature.set("status", drone.status);
          existingFeature.set("altitude", drone.altitude);
          existingFeature.set("speed", drone.speed);
          existingFeature.set("heading", drone.heading);
          existingFeature.changed();
        } else {
          const point = new Point(
            fromLonLat([drone.longitude, drone.latitude])
          );
          const feature = new Feature({
            geometry: point,
            droneId: drone.id,
            name: drone.name,
            status: drone.status,
            altitude: drone.altitude,
            speed: drone.speed,
            heading: drone.heading,
            type: "drone",
          });
          source.addFeature(feature);
        }
      });
    },
    [filters, isDroneInAnyZone]
  );

  useEffect(() => {
    updateDroneFeatures(drones);
  }, [drones, filters, updateDroneFeatures]);

  const updateZoneFeatures = useCallback((zonesData: CoverageZone[]) => {
    if (!zoneLayerRef.current) return;

    const source = zoneLayerRef.current.getSource();
    if (!source) return;

    source.clear();

    zonesData.forEach((zone) => {
      const circle = new CircleGeom(
        fromLonLat([zone.centerLon, zone.centerLat]),
        zone.radiusMeters
      );

      const feature = new Feature({
        geometry: circle,
        zoneId: zone.id,
        name: zone.name,
        type: "zone",
      });

      source.addFeature(feature);
    });

    console.log(`✅ Updated ${zonesData.length} coverage zones`);
  }, []);

  const displayTrajectory = useCallback((droneId: number, points: any[]) => {
    if (!trajectoryLayerRef.current) return;

    const source = trajectoryLayerRef.current.getSource();
    if (!source) return;

    source.clear();

    if (points.length < 2) return;

    const coords = points.map((p) => fromLonLat([p.longitude, p.latitude]));
    const line = new LineString(coords);
    const feature = new Feature({
      geometry: line,
      droneId: droneId,
      type: "trajectory",
    });

    source.addFeature(feature);
    console.log(`✅ Displayed trajectory with ${points.length} points`);
  }, []);

  const clearAllTrajectories = useCallback(() => {
    if (trajectoryLayerRef.current) {
      const source = trajectoryLayerRef.current.getSource();
      if (source) {
        source.clear();
        console.log("🧹 Cleared all trajectories");
      }
    }
    setDisplayedTrajectoryDroneId(null);
  }, []);

  const applyFilters = useCallback((newFilters: DroneFilters) => {
    console.log("🔧 Applying filters:", newFilters);
    setFilters(newFilters);
  }, []);

  const toggleMapType = useCallback(() => {
    const newType = mapType === "osm" ? "satellite" : "osm";
    setMapType(newType);

    if (!mapInstanceRef.current) return;

    const layers = mapInstanceRef.current.getLayers();
    const baseLayer = layers.item(0) as TileLayer<XYZ>;

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
  }, [mapType]);

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

  const handleDroneSelect = (drone: Drone) => {
    console.log("🔍 Drone selected from list:", drone.name);
    setSelectedDrone(drone);
    setDisplayedTrajectoryDroneId(drone.id);
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
      setDisplayedTrajectoryDroneId(droneId);
      loadDroneTrajectory(droneId);
    }
  };

  const handleCenterMap = () => {
    if (!mapInstanceRef.current) return;
    const view = mapInstanceRef.current.getView();
    view.animate({
      center: fromLonLat([27.5615, 53.9006]),
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
      <FilterPanel
        filters={filters}
        onFiltersChange={applyFilters}
        stats={stats}
        isConnected={isConnected}
      />

      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {tooltip && (
          <DroneTooltip drone={tooltip.drone} x={tooltip.x} y={tooltip.y} />
        )}

        {showAlarm && (
          <AlarmPanel
            dronesInZones={dronesInZonesCount}
            onDismiss={() => setShowAlarm(false)}
          />
        )}

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

        {selectedDrone && (
          <DroneInfoPanel
            drone={selectedDrone}
            onClose={() => {
              setSelectedDrone(null);
              clearAllTrajectories();
            }}
          />
        )}

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
