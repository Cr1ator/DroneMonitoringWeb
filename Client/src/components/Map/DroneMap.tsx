import React, { useEffect, useState, useRef, useCallback } from "react";
import { Map, View } from "ol";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { XYZ } from "ol/source";
import { Vector as VectorSource } from "ol/source";
import { Feature } from "ol";
import { Point, LineString, Polygon } from "ol/geom";
import { Style, Stroke, Fill, Text, Circle as CircleStyle } from "ol/style";
import { fromLonLat } from "ol/proj";
import { getDistance, offset } from "ol/sphere";
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
  TrajectoryPoint,
} from "../../types/drone";
import type { FeatureLike } from "ol/Feature";
import { DroneInfoPanel } from "../DroneInfoPanel";
import { FilterPanel } from "./../FilterPanel";
import { MapControls } from "./../MapControls";
import { DroneList } from "../DroneList";
import { DroneHistoryPanel } from "../DroneHistoryPanel";

// Компонент Tooltip для дронов (без изменений)
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

// Панель тревоги теперь принимает количество активных зон
const AlarmPanel: React.FC<{
  activeZonesCount: number;
  onDismiss: () => void;
}> = ({ activeZonesCount, onDismiss }) => {
  if (activeZonesCount === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="military-panel border-2 border-red-500 bg-red-900/90 px-6 py-3 rounded-lg shadow-2xl animate-pulse">
        <div className="flex items-center space-x-4">
          <GiRadioactive className="w-8 h-8 text-red-400 animate-spin" />
          <div>
            <div className="text-red-200 font-bold text-lg">ТРЕВОГА!</div>
            <div className="text-red-300 text-sm">
              Дроны обнаружены в {activeZonesCount} зон(е/ах)
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
  const dronesInZonesRef = useRef<Set<number>>(new Set());

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

  const [activeZoneIds, setActiveZoneIds] = useState<Set<number>>(new Set());
  const [isAlarmDismissed, setIsAlarmDismissed] = useState(false);

  useEffect(() => {
    dronesRef.current = drones;
  }, [drones]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const isPointInAnyZone = useCallback(
    (point: { lon: number; lat: number }): boolean => {
      if (zonesRef.current.length === 0) return false;
      for (const zone of zonesRef.current) {
        const distance = getDistance(
          [point.lon, point.lat],
          [zone.centerLon, zone.centerLat]
        );
        if (distance <= zone.radiusMeters) {
          return true;
        }
      }
      return false;
    },
    []
  );

  const isDroneInAnyZone = useCallback(
    (drone: Drone): boolean => {
      return isPointInAnyZone({ lon: drone.longitude, lat: drone.latitude });
    },
    [isPointInAnyZone]
  );

  useEffect(() => {
    const activeDronesInZones = drones.filter(
      (d) => d.status === "Active" && isDroneInAnyZone(d)
    );

    activeDronesInZones.forEach((drone) => {
      if (!dronesInZonesRef.current.has(drone.id)) {
        console.log(
          `🛸 Новый дрон в зоне: ${drone.name}, загружаем траекторию`
        );
        dronesInZonesRef.current.add(drone.id);
        if (
          connectionRef.current?.state === signalR.HubConnectionState.Connected
        ) {
          connectionRef.current.invoke("GetDroneTrajectory", drone.id, 1);
        }
      }
    });

    const currentIdsInZone = new Set(activeDronesInZones.map((d) => d.id));
    dronesInZonesRef.current.forEach((id) => {
      if (!currentIdsInZone.has(id)) {
        console.log(`🛸 Дрон ${id} вышел из зоны`);
        dronesInZonesRef.current.delete(id);
      }
    });
  }, [drones, isDroneInAnyZone]);

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
      style: (feature) => createZoneStyle(feature, false),
      zIndex: 50,
      opacity: 0.7,
    });
    zoneLayerRef.current = zoneLayer;

    const trajectorySource = new VectorSource();
    const trajectoryLayer = new VectorLayer({
      source: trajectorySource,
      style: createTrajectoryStyle,
      zIndex: 80,
    });
    trajectoryLayerRef.current = trajectoryLayer;

    const darkTileLayer = new TileLayer({
      source: new XYZ({
        url: "https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
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
          handleDroneSelect(drone, true);
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
          setTooltip({ drone, x: event.pixel[0], y: event.pixel[1] });
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

  useEffect(() => {
    if (!zoneLayerRef.current) return;

    const newZoneStyleFunction = (feature: FeatureLike) => {
      const zoneId = feature.get("zoneId") as number;
      const isAlarm = activeZoneIds.has(zoneId);
      return createZoneStyle(feature, isAlarm);
    };

    zoneLayerRef.current.setStyle(newZoneStyleFunction);

    // ✅ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Принудительно перерисовываем слой
    zoneLayerRef.current.getSource()?.changed();

    if (activeZoneIds.size > 0) {
      setIsAlarmDismissed(false);
    }
  }, [activeZoneIds]);

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

    connection.on("DronesUpdated", (updates: any[]) => {
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
    });

    connection.on("CoverageZones", (zonesData: any[]) => {
      console.log("🛡️ Received coverage zones:", zonesData);
      setZones(zonesData);
      updateZoneFeatures(zonesData);
    });

    connection.on("DroneStatistics", (statsData: any) => {
      setStats(statsData);
    });

    connection.on("DroneTrajectory", (data: any) => {
      console.log("📈 Received trajectory for drone", data.droneId);
      setSelectedDrone((prevSelected) => {
        if (
          prevSelected &&
          prevSelected.id === data.droneId &&
          data.points &&
          data.points.length > 0
        ) {
          displayTrajectory(data.droneId, data.points);
        }
        return prevSelected;
      });
    });

    connection.on("ActiveZonesUpdated", (zoneIds: number[]) => {
      setActiveZoneIds(new Set(zoneIds));
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

    if (selectedDrone) {
      const isSelectedDroneVisible =
        (filters.statusFilter.length === 0 ||
          filters.statusFilter.includes(selectedDrone.status)) &&
        (filters.frequencyFilter.length === 0 ||
          filters.frequencyFilter.includes(selectedDrone.frequency)) &&
        isDroneInAnyZone(selectedDrone);

      if (!isSelectedDroneVisible) {
        clearAllTrajectories();
        setSelectedDrone(null);
        console.log(
          `🧹 Drone ${selectedDrone.name} is no longer visible. Selection cleared.`
        );
      }
    }
  }, [drones, filters, selectedDrone, updateDroneFeatures, isDroneInAnyZone]);

  const updateZoneFeatures = useCallback((zonesData: CoverageZone[]) => {
    if (!zoneLayerRef.current) return;
    const source = zoneLayerRef.current.getSource();
    if (!source) return;
    source.clear();
    zonesData.forEach((zone) => {
      const centerLonLat = [zone.centerLon, zone.centerLat];
      const points = [];
      for (let i = 0; i < 64; i++) {
        const angle = (i / 64) * 2 * Math.PI;
        const pointOnCircle = offset(centerLonLat, zone.radiusMeters, angle);
        points.push(fromLonLat(pointOnCircle));
      }
      const circlePolygon = new Polygon([points]);
      const feature = new Feature({
        geometry: circlePolygon,
        zoneId: zone.id,
        name: zone.name,
        type: "zone",
      });
      source.addFeature(feature);
    });
    console.log(
      `✅ Updated ${zonesData.length} coverage zones with geodesic polygons`
    );
  }, []);

  const displayTrajectory = useCallback(
    (droneId: number, points: TrajectoryPoint[]) => {
      if (!trajectoryLayerRef.current) return;
      const source = trajectoryLayerRef.current.getSource();
      if (!source) return;
      source.clear();
      if (points.length < 2) {
        console.log(`⚠️ Not enough points for trajectory (${points.length})`);
        return;
      }
      const segments: { lon: number; lat: number }[][] = [];
      let currentSegment: { lon: number; lat: number }[] = [];
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const pointIsInZone = isPointInAnyZone(point);
        if (pointIsInZone) {
          currentSegment.push(point);
        } else {
          if (currentSegment.length > 1) {
            segments.push(currentSegment);
          }
          currentSegment = [];
        }
      }
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      if (segments.length === 0) {
        console.log(
          `ℹ️ Trajectory for drone ${droneId} is entirely outside coverage zones.`
        );
        return;
      }
      segments.forEach((segment, index) => {
        const coords = segment.map((p) => fromLonLat([p.lon, p.lat]));
        const line = new LineString(coords);
        const feature = new Feature({
          geometry: line,
          droneId: droneId,
          type: "trajectory",
          segmentId: `${droneId}-${index}`,
        });
        source.addFeature(feature);
      });
      console.log(
        `✅ Displayed ${segments.length} trajectory segments for drone ${droneId}`
      );
    },
    [isPointInAnyZone]
  );

  const clearAllTrajectories = useCallback(() => {
    if (trajectoryLayerRef.current) {
      const source = trajectoryLayerRef.current.getSource();
      if (source) {
        source.clear();
        console.log("🧹 Cleared all trajectories");
      }
    }
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

  const handleDroneSelect = (drone: Drone, centerAndZoom: boolean = false) => {
    console.log("🔍 Drone selected:", drone.name);
    if (selectedDrone?.id === drone.id) return;
    setSelectedDrone(drone);
    loadDroneTrajectory(drone.id);
    if (centerAndZoom && mapInstanceRef.current) {
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
    if (drone) {
      handleDroneSelect(drone, true);
    }
  };

  const handleCenterMap = () => {
    if (!mapInstanceRef.current) return;
    const view = mapInstanceRef.current.getView();
    view.animate({ center: fromLonLat([27.5615, 53.9006]), duration: 500 });
  };

  const handleResetZoom = () => {
    if (!mapInstanceRef.current) return;
    const view = mapInstanceRef.current.getView();
    view.animate({ zoom: 12, duration: 500 });
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
        {!isAlarmDismissed && activeZoneIds.size > 0 && (
          <AlarmPanel
            activeZonesCount={activeZoneIds.size}
            onDismiss={() => setIsAlarmDismissed(true)}
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
            onDroneSelect={(drone) => handleDroneSelect(drone, true)}
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
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),
    text: new Text({
      text: `${name}\n${altitude?.toFixed(0) || 0}m\n${
        speed?.toFixed(1) || 0
      }m/s`,
      offsetY: -25,
      font: "bold 11px 'Courier New', monospace",
      fill: new Fill({ color: color }),
      stroke: new Stroke({ color: "#000000", width: 4 }),
      backgroundFill: new Fill({ color: "rgba(0, 0, 0, 0.8)" }),
      padding: [4, 6, 4, 6],
    }),
  });
}

function createZoneStyle(
  feature: FeatureLike,
  isAlarm: boolean = false
): Style {
  const name = feature.get("name") as string;
  const baseColor = isAlarm ? "239, 68, 68" : "34, 197, 94";
  const hexColor = isAlarm ? "#ef4444" : "#22c55e";
  return new Style({
    fill: new Fill({ color: `rgba(${baseColor}, 0.2)` }),
    stroke: new Stroke({
      color: `rgba(${baseColor}, 0.9)`,
      width: isAlarm ? 5 : 4,
    }),
    text: new Text({
      text: name || "ЗОНА",
      font: "bold 16px 'Courier New', monospace",
      fill: new Fill({ color: hexColor }),
      stroke: new Stroke({ color: "#000000", width: 5 }),
      backgroundFill: new Fill({ color: "rgba(0, 0, 0, 0.9)" }),
      padding: [8, 12, 8, 12],
    }),
  });
}

function createTrajectoryStyle(feature: FeatureLike): Style {
  return new Style({
    stroke: new Stroke({
      color: "rgba(251, 191, 36, 0.9)",
      width: 5,
      lineCap: "round",
      lineJoin: "round",
    }),
  });
}
