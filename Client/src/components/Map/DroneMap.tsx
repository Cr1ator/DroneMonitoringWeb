import React, { useEffect, useState, useRef, useCallback } from "react";
import { Map, View } from "ol";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { XYZ } from "ol/source";
import { Vector as VectorSource } from "ol/source";
import { Feature } from "ol";
import { Point, LineString, Polygon } from "ol/geom";
import {
  Style,
  Stroke,
  Fill,
  Text,
  Circle as CircleStyle,
  Icon,
} from "ol/style";
import { fromLonLat, toLonLat } from "ol/proj";
import { getDistance as getGeodesicDistance, offset } from "ol/sphere";
import { Draw, Modify } from "ol/interaction";
import * as signalR from "@microsoft/signalr";
import { TbDrone } from "react-icons/tb";
import { GiDeliveryDrone } from "react-icons/gi";
import { IoWarningOutline } from "react-icons/io5";
import { MdClose, MdSettings, MdCheckCircle, MdInfo } from "react-icons/md";
import { HiOutlineFilter } from "react-icons/hi";
import { FaChevronUp, FaChevronDown } from "react-icons/fa";
import ReactDOMServer from "react-dom/server";
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
import { RulerControl } from "../RulerControl";
import { RulerEditPanel } from "../RulerEditPanel";
import { AboutModal } from "../AboutModal";

import useLocalStorageState from "../../hooks/useLocalStorageState";

const HamburgerIcon = () => (
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
);

interface ActiveZoneInfo {
  zoneId: number;
  zoneName: string;
  droneCount: number;
}

interface RulerData {
  totalDistance: number;
  segmentDistances: number[];
  coordinates: { lon: number; lat: number }[];
}

const DroneTooltip: React.FC<{
  drone: Drone;
  x: number;
  y: number;
}> = ({ drone, x, y }) => {
  return (
    <div
      className="drone-tooltip hidden lg:block"
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

const AlarmPanel: React.FC<{
  activeZones: ActiveZoneInfo[];
  onDismiss: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ activeZones, onDismiss, isCollapsed, onToggleCollapse }) => {
  if (activeZones.length === 0) return null;

  const totalDrones = activeZones.reduce(
    (sum, zone) => sum + zone.droneCount,
    0
  );

  return (
    <div
      className={`fixed top-2 left-1/2 transform -translate-x-1/2 z-60 w-auto max-w-sm md:max-w-lg px-2 md:px-4 transition-transform duration-300 ease-in-out ${
        isCollapsed ? "-translate-y-[calc(100%+1rem)]" : "translate-y-0"
      }`}
    >
      <div className="military-panel border-2 border-red-500 bg-red-900/95 backdrop-blur-sm px-3 py-2 md:px-4 md:py-3 rounded-lg shadow-2xl animate-pulse">
        <div className="flex items-start space-x-2 md:space-x-3">
          <IoWarningOutline className="w-6 h-6 md:w-7 md:h-7 text-red-400 animate-[warning-pulse_1.5s_ease-in-out_infinite] flex-shrink-0 mt-0.5" />
          <div className="grow min-w-0">
            <div className="text-red-200 font-bold text-sm md:text-base mb-1">
              ТРЕВОГА!
            </div>
            <div className="text-red-300 text-xs md:text-sm mb-2">
              Обнаружено {totalDrones} дрон(ов) в {activeZones.length}{" "}
              зон(е/ах):
            </div>
            <div className="space-y-1 text-red-200 tech-font text-xs">
              {activeZones.map((zone) => (
                <div
                  key={zone.zoneId}
                  className="flex justify-between items-center bg-red-500/20 px-2 py-1 rounded"
                >
                  <span className="truncate mr-2">{zone.zoneName}</span>
                  <span className="font-bold whitespace-nowrap text-xs">
                    {zone.droneCount} дрон(а)
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col space-y-2">
            <button
              onClick={onDismiss}
              className="military-button p-1.5 md:p-2 rounded text-red-400 hover:text-white flex-shrink-0 transition-colors"
              title="Закрыть навсегда"
            >
              <MdClose className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="military-button p-1.5 md:p-2 rounded text-gray-300 hover:text-white flex-shrink-0 transition-colors"
              title="Свернуть"
            >
              <FaChevronUp className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const rulerCursorStyle = new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "rgba(0, 255, 255, 0.5)" }),
    stroke: new Stroke({ color: "#00ffff", width: 1 }),
  }),
});

export const DroneMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const droneLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const zoneLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const trajectoryLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const rulerLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const rulerInteractionsRef = useRef<{
    draw?: Draw;
    modify?: Modify;
  }>({});
  const rulerFeatureRef = useRef<Feature | null>(null);

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
  const [showDroneList, setShowDroneList] = useLocalStorageState(
    "showDroneList",
    true
  );
  const [showFilterPanel, setShowFilterPanel] = useLocalStorageState(
    "showFilterPanel",
    true
  );
  const [showMapControls, setShowMapControls] = useLocalStorageState(
    "showMapControls",
    false
  );
  const [showHistory, setShowHistory] = useState(false);
  const [historyDroneId, setHistoryDroneId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{
    drone: Drone;
    x: number;
    y: number;
  } | null>(null);

  const [activeZones, setActiveZones] = useState<ActiveZoneInfo[]>([]);
  const [isAlarmDismissed, setIsAlarmDismissed] = useState(false);
  const [isRulerActive, setIsRulerActive] = useState(false);
  const [rulerData, setRulerData] = useState<RulerData | null>(null);
  const [rulerMode, setRulerMode] = useState<"drawing" | "modifying">(
    "drawing"
  );
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(
    null
  );
  const [isMovingVertex, setIsMovingVertex] = useState<boolean>(false);
  const [showRulerControlPanel, setShowRulerControlPanel] = useState(true);
  const [isAlarmPanelCollapsed, setIsAlarmPanelCollapsed] =
    useLocalStorageState("isAlarmPanelCollapsed", false);
  const [isRulerPanelCollapsed, setIsRulerPanelCollapsed] = useState(false);

  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  const isRulerActiveRef = useRef(isRulerActive);
  useEffect(() => {
    isRulerActiveRef.current = isRulerActive;
  }, [isRulerActive]);

  // ... (useEffect для мобильных панелей, dronesRef, zonesRef, isPointInAnyZone, isDroneInAnyZone, useEffect для дронов в зонах)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setShowDroneList(false);
      setShowFilterPanel(false);
    }
  }, []);

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
        const distance = getGeodesicDistance(
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
      if (isRulerActiveRef.current) return;
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
      if (isRulerActiveRef.current) {
        map.getTargetElement().style.cursor = "";
        setTooltip(null);
        return;
      }
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

  // ... (useEffect для анимации зон, обновления стилей зон, SignalR, и т.д. остаются без изменений)
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

    const currentActiveIds = new Set(activeZones.map((z) => z.zoneId));

    const newZoneStyleFunction = (feature: FeatureLike) => {
      const zoneId = feature.get("zoneId") as number;
      const isAlarm = currentActiveIds.has(zoneId);
      return createZoneStyle(feature, isAlarm);
    };

    zoneLayerRef.current.setStyle(newZoneStyleFunction);
    zoneLayerRef.current.getSource()?.changed();

    if (activeZones.length > 0) {
      setIsAlarmDismissed(false);
    }
  }, [activeZones]);

  useEffect(() => {
    const hubUrl = import.meta.env.VITE_HUB_URL || "/droneHub";
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
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

    connection.on("ZoneActivityUpdated", (zoneInfo: ActiveZoneInfo[]) => {
      setActiveZones(zoneInfo);
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
      // const existingIds = new Set(
      //   existingFeatures.map((f) => f.get("droneId"))
      // );
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

  const closeAllMobilePanels = () => {
    setShowDroneList(false);
    setShowFilterPanel(false);
    setShowMapControls(false);
  };

  const updateRulerMeasurements = useCallback((feature: Feature | null) => {
    if (!feature) {
      setRulerData(null);
      return;
    }

    const geometry = feature.getGeometry() as LineString;
    const coordinates = geometry.getCoordinates();
    if (coordinates.length < 2) {
      setRulerData({
        totalDistance: 0,
        segmentDistances: [],
        coordinates: coordinates.map((c) => ({
          lon: toLonLat(c)[0],
          lat: toLonLat(c)[1],
        })),
      });
      return;
    }

    const lonLatCoords = coordinates.map((c) => toLonLat(c));

    let totalDistance = 0;
    const segmentDistances: number[] = [];

    for (let i = 0; i < lonLatCoords.length - 1; i++) {
      const dist = getGeodesicDistance(lonLatCoords[i], lonLatCoords[i + 1]);
      segmentDistances.push(dist);
      totalDistance += dist;
    }

    setRulerData({
      totalDistance,
      segmentDistances,
      coordinates: lonLatCoords.map((c) => ({ lon: c[0], lat: c[1] })),
    });
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const cleanupInteractions = () => {
      if (rulerInteractionsRef.current.draw)
        map.removeInteraction(rulerInteractionsRef.current.draw);
      if (rulerInteractionsRef.current.modify)
        map.removeInteraction(rulerInteractionsRef.current.modify);
      rulerInteractionsRef.current = {};
    };

    if (isRulerActive) {
      if (!rulerLayerRef.current) {
        const source = new VectorSource();
        const layer = new VectorLayer({
          source: source,
          style: (feat) => createRulerStyle(feat, selectedVertexIndex),
          zIndex: 200,
        });
        map.addLayer(layer);
        rulerLayerRef.current = layer;
      }

      cleanupInteractions();

      if (rulerMode === "drawing") {
        const source = rulerLayerRef.current.getSource();
        if (!source) return;

        const draw = new Draw({
          source: source,
          type: "Point",
          style: rulerCursorStyle,
        });

        draw.on("drawend", (event) => {
          const pointGeom = event.feature.getGeometry() as Point;
          const coord = pointGeom.getCoordinates();

          source.removeFeature(event.feature);

          if (!rulerFeatureRef.current) {
            const newLine = new LineString([coord]);
            rulerFeatureRef.current = new Feature(newLine);
            source.addFeature(rulerFeatureRef.current);
          } else {
            const lineGeom =
              rulerFeatureRef.current.getGeometry() as LineString;
            lineGeom.appendCoordinate(coord);
          }
          updateRulerMeasurements(rulerFeatureRef.current);
        });

        map.addInteraction(draw);
        rulerInteractionsRef.current.draw = draw;
      } else if (rulerMode === "modifying") {
        const isDesktop = window.innerWidth >= 1024;
        if (isDesktop) {
          const source = rulerLayerRef.current.getSource();
          if (!source) return;
          const modify = new Modify({ source: source });
          modify.on("modifyend", (event) => {
            const feature = event.features.getArray()[0];
            if (feature) updateRulerMeasurements(feature);
          });
          map.addInteraction(modify);
          rulerInteractionsRef.current.modify = modify;
        }
      }
    } else {
      cleanupInteractions();
      if (rulerLayerRef.current) {
        rulerLayerRef.current.getSource()?.clear();
        map.removeLayer(rulerLayerRef.current);
        rulerLayerRef.current = null;
      }
      rulerFeatureRef.current = null;
      updateRulerMeasurements(null);
      setSelectedVertexIndex(null);
      setIsMovingVertex(false);
    }

    return () => {
      cleanupInteractions();
    };
  }, [isRulerActive, rulerMode, updateRulerMeasurements, selectedVertexIndex]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || rulerMode !== "modifying" || isMovingVertex) {
      return;
    }

    const handleModifyClick = (event: any) => {
      if (!rulerFeatureRef.current) return;

      const clickedPixel = event.pixel;
      const hitTolerance = 20;

      const lineGeom = rulerFeatureRef.current.getGeometry() as LineString;
      const coords = lineGeom.getCoordinates();

      for (let i = 0; i < coords.length; i++) {
        const vertexPixel = map.getPixelFromCoordinate(coords[i]);
        if (!vertexPixel) continue;

        const distance = Math.sqrt(
          Math.pow(clickedPixel[0] - vertexPixel[0], 2) +
            Math.pow(clickedPixel[1] - vertexPixel[1], 2)
        );

        if (distance <= hitTolerance) {
          setSelectedVertexIndex(i);
          setShowRulerControlPanel(false);
          rulerLayerRef.current?.getSource()?.changed();
          return;
        }
      }

      setSelectedVertexIndex(null);
      setShowRulerControlPanel(true);
      rulerLayerRef.current?.getSource()?.changed();
    };

    map.on("click", handleModifyClick);

    return () => {
      map.un("click", handleModifyClick);
    };
  }, [rulerMode, isMovingVertex, updateRulerMeasurements]);

  const handleUndo = () => {
    if (!rulerFeatureRef.current) return;
    const lineGeom = rulerFeatureRef.current.getGeometry() as LineString;
    const coords = lineGeom.getCoordinates();
    if (coords.length > 0) {
      const newCoords = coords.slice(0, -1);
      if (newCoords.length === 0) {
        rulerLayerRef.current?.getSource()?.clear();
        rulerFeatureRef.current = null;
      } else {
        lineGeom.setCoordinates(newCoords);
      }
      updateRulerMeasurements(rulerFeatureRef.current);
    }
  };

  const handleDeleteVertex = () => {
    if (selectedVertexIndex === null || !rulerFeatureRef.current) return;
    const lineGeom = rulerFeatureRef.current.getGeometry() as LineString;
    const coords = lineGeom.getCoordinates();
    if (coords.length > 2) {
      const newCoords = coords.filter((_, i) => i !== selectedVertexIndex);
      lineGeom.setCoordinates(newCoords);
      updateRulerMeasurements(rulerFeatureRef.current);
    }
    setSelectedVertexIndex(null);
    setShowRulerControlPanel(true);
  };

  const handleStartMoveVertex = () => {
    setIsMovingVertex(true);
  };

  const handleConfirmMoveVertex = () => {
    if (
      selectedVertexIndex === null ||
      !rulerFeatureRef.current ||
      !mapInstanceRef.current
    )
      return;

    const newCoord = mapInstanceRef.current.getView().getCenter();
    if (!newCoord) return;

    const lineGeom = rulerFeatureRef.current.getGeometry() as LineString;
    const coords = lineGeom.getCoordinates();
    coords[selectedVertexIndex] = newCoord;
    lineGeom.setCoordinates(coords);
    updateRulerMeasurements(rulerFeatureRef.current);

    setIsMovingVertex(false);
    setSelectedVertexIndex(null);
    setShowRulerControlPanel(true);
  };

  return (
    <div className="flex h-screen bg-gray-900 military-grid relative overflow-hidden">
      {(showDroneList || showFilterPanel || showMapControls) && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={closeAllMobilePanels}
        />
      )}

      <div
        className={`
        flex-shrink-0
        transition-all duration-300 ease-in-out
        bg-gray-900
        h-full
        overflow-hidden
        ${showFilterPanel ? "w-80" : "w-0"}
        fixed lg:static inset-y-0 left-0 z-40
      `}
      >
        <div className="w-80 h-full">
          <FilterPanel
            filters={filters}
            onFiltersChange={applyFilters}
            stats={stats}
            isConnected={isConnected}
            onClose={() => setShowFilterPanel(false)}
          />
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {isMovingVertex && (
          <>
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <div className="w-8 h-8 border-2 border-red-500 rounded-full bg-red-500/20 animate-pulse"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-12 bg-red-500"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-px bg-red-500"></div>
            </div>
            <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30">
              <button
                onClick={handleConfirmMoveVertex}
                className="military-button p-3 rounded-lg text-green-400 flex items-center text-lg shadow-2xl"
              >
                <MdCheckCircle className="w-6 h-6 mr-2" />
                Подтвердить
              </button>
            </div>
          </>
        )}

        {tooltip && (
          <DroneTooltip drone={tooltip.drone} x={tooltip.x} y={tooltip.y} />
        )}

        {!isAlarmDismissed && activeZones.length > 0 && (
          <>
            <AlarmPanel
              activeZones={activeZones}
              onDismiss={() => setIsAlarmDismissed(true)}
              isCollapsed={isAlarmPanelCollapsed}
              onToggleCollapse={() => setIsAlarmPanelCollapsed(true)}
            />
            {isAlarmPanelCollapsed && (
              <button
                onClick={() => setIsAlarmPanelCollapsed(false)}
                className="fixed top-0 left-1/2 transform -translate-x-1/2 z-[60] military-button p-2 rounded-b-lg text-red-400 animate-pulse"
                title="Показать тревогу"
              >
                <IoWarningOutline className="w-5 h-5 mr-2" />
                <span>ТРЕВОГА</span>
                <FaChevronDown className="w-4 h-4 ml-2" />
              </button>
            )}
          </>
        )}

        <div className="absolute top-20 left-4 hidden lg:flex flex-col space-y-2 z-20">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="military-button p-3 rounded-lg text-green-400 hover:text-white shadow-xl backdrop-blur-sm bg-gray-900/90"
            title={showFilterPanel ? "Скрыть фильтры" : "Показать фильтры"}
          >
            <HiOutlineFilter className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowMapControls(!showMapControls)}
            className="military-button p-3 rounded-lg text-green-400 hover:text-white shadow-xl backdrop-blur-sm bg-gray-900/90"
            title={
              showMapControls
                ? "Скрыть настройки карты"
                : "Показать настройки карты"
            }
          >
            <MdSettings className="w-6 h-6" />
          </button>
          <button
            onClick={() => setIsAboutModalOpen(true)}
            className="military-button p-3 rounded-lg text-green-400 hover:text-white shadow-xl backdrop-blur-sm bg-gray-900/90"
            title="О проекте"
          >
            <MdInfo className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 flex flex-col space-y-2 z-20 lg:hidden">
          <button
            onClick={() => {
              setShowFilterPanel(!showFilterPanel);
              setShowDroneList(false);
              setShowMapControls(false);
            }}
            className="military-button p-3 rounded-lg text-green-400 hover:text-white shadow-xl backdrop-blur-sm bg-gray-900/90"
            title="Фильтры"
          >
            <HiOutlineFilter className="w-6 h-6" />
          </button>

          <button
            onClick={() => {
              setShowMapControls(!showMapControls);
              setShowDroneList(false);
              setShowFilterPanel(false);
            }}
            className="military-button p-3 rounded-lg text-green-400 hover:text-white shadow-xl backdrop-blur-sm bg-gray-900/90"
            title="Настройки карты"
          >
            <MdSettings className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              setIsAboutModalOpen(true);
              setShowDroneList(false);
              setShowFilterPanel(false);
              setShowMapControls(false);
            }}
            className="military-button p-3 rounded-lg text-green-400 hover:text-white shadow-xl backdrop-blur-sm bg-gray-900/90"
            title="О проекте"
          >
            <MdInfo className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute bottom-4 right-4 z-20 lg:hidden">
          <button
            onClick={() => {
              setShowDroneList(!showDroneList);
              setShowFilterPanel(false);
              setShowMapControls(false);
            }}
            className="military-button p-3 rounded-lg text-green-400 hover:text-white shadow-xl backdrop-blur-sm bg-gray-900/90"
            title="Список дронов"
          >
            <HamburgerIcon />
          </button>
        </div>

        <div
          className={`
          flex-shrink-0
          transition-all duration-300 ease-in-out
          bg-gray-900
          h-full
          overflow-hidden
          ${showMapControls ? "w-80" : "w-0"}
          fixed lg:absolute inset-y-0 lg:inset-auto left-0 lg:left-4 lg:bottom-4 lg:top-auto lg:h-auto z-40 lg:z-10
        `}
        >
          <div className="w-80 h-full lg:h-auto">
            <MapControls
              mapType={mapType}
              showZones={showZones}
              showTrajectories={showTrajectories}
              isRulerActive={isRulerActive}
              onToggleMapType={() => {
                toggleMapType();
                if (window.innerWidth < 1024) {
                  setShowMapControls(false);
                }
              }}
              onToggleZones={() => {
                setShowZones(!showZones);
                if (window.innerWidth < 1024) {
                  setShowMapControls(false);
                }
              }}
              onToggleTrajectories={() => {
                setShowTrajectories(!showTrajectories);
                if (window.innerWidth < 1024) {
                  setShowMapControls(false);
                }
              }}
              onCenterMap={() => {
                handleCenterMap();
                if (window.innerWidth < 1024) {
                  setShowMapControls(false);
                }
              }}
              onResetZoom={() => {
                handleResetZoom();
                if (window.innerWidth < 1024) {
                  setShowMapControls(false);
                }
              }}
              onToggleRuler={() => {
                const nextState = !isRulerActive;
                setIsRulerActive(nextState);
                if (nextState) {
                  setRulerMode("drawing");
                  setShowRulerControlPanel(true);
                  setIsRulerPanelCollapsed(false);
                }
                if (window.innerWidth < 1024) {
                  setShowMapControls(false);
                }
              }}
              onClose={() => setShowMapControls(false)}
            />
          </div>
        </div>

        {isRulerActive && showRulerControlPanel && (
          <RulerControl
            rulerData={rulerData}
            isDrawing={rulerMode === "drawing"}
            isCollapsed={isRulerPanelCollapsed}
            onClose={() => setIsRulerActive(false)}
            onContinueDrawing={() => setRulerMode("drawing")}
            onFinishDrawing={() => setRulerMode("modifying")}
            onUndo={handleUndo}
            onToggleCollapse={() =>
              setIsRulerPanelCollapsed(!isRulerPanelCollapsed)
            }
          />
        )}

        <RulerEditPanel
          isVisible={selectedVertexIndex !== null && !isMovingVertex}
          onMove={handleStartMoveVertex}
          onDelete={handleDeleteVertex}
          onDeselect={() => {
            setSelectedVertexIndex(null);
            setShowRulerControlPanel(true);
            rulerLayerRef.current?.getSource()?.changed();
          }}
        />

        {selectedDrone && (
          <DroneInfoPanel
            drone={selectedDrone}
            isListVisible={showDroneList}
            onClose={() => {
              setSelectedDrone(null);
              clearAllTrajectories();
            }}
          />
        )}

        <button
          onClick={() => setShowDroneList(!showDroneList)}
          className="!hidden lg:!flex absolute top-4 right-4 military-button p-3 rounded-lg text-green-400 hover:text-white z-10"
          title={showDroneList ? "Скрыть список" : "Показать список"}
        >
          <HamburgerIcon />
        </button>
      </div>

      <div
        className={`
          bg-gray-900 h-full
          transition-all duration-300 ease-in-out
          fixed inset-y-0 right-0 z-40 w-full sm:w-96
          transform ${showDroneList ? "translate-x-0" : "translate-x-full"}
          lg:static lg:shrink-0 lg:transform-none
          lg:overflow-hidden ${showDroneList ? "lg:w-96" : "lg:w-0"}
        `}
      >
        <div className="w-full sm:w-96 lg:w-96 h-full flex flex-col">
          <DroneList
            drones={drones}
            selectedDrone={selectedDrone}
            onDroneSelect={(drone) => {
              handleDroneSelect(drone, true);
              if (window.innerWidth < 1024) {
                setShowDroneList(false);
              }
            }}
            onDroneTrack={handleDroneTrack}
            onClose={() => setShowDroneList(false)}
          />
        </div>
      </div>

      {showHistory && historyDroneId && (
        <div className="fixed inset-0 lg:inset-auto lg:right-0 lg:top-0 lg:bottom-0 lg:w-96 z-50">
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
        </div>
      )}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />
    </div>
  );
};

const createDroneIconDataUri = (status: string) => {
  const bgColor = status === "Active" ? "#22c55e" : "#ef4444";

  const svgString = ReactDOMServer.renderToStaticMarkup(
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      {status === "Active" && (
        <circle
          cx="20"
          cy="20"
          r="14"
          fill="none"
          stroke={bgColor}
          strokeWidth="2"
          opacity="0.6"
        >
          <animate
            attributeName="r"
            values="14;18;14"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0;0.6"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      <circle cx="20" cy="20" r="18" fill="#1a1a1a" />
      <circle cx="20" cy="20" r="15" fill={bgColor} />
      <circle
        cx="20"
        cy="20"
        r="11"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
      />
      <g transform="translate(20, 20)">
        <g transform="scale(1.3) translate(-7, -7)">
          <GiDeliveryDrone
            style={{
              color: "#ffffff",
              fontSize: "14px",
            }}
          />
        </g>
      </g>
    </svg>
  );
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
};

function createDroneStyle(feature: FeatureLike): Style {
  const status = feature.get("status") as string;
  const name = feature.get("name") as string;
  const altitude = feature.get("altitude") as number;
  const speed = feature.get("speed") as number;
  const heading = feature.get("heading") as number;
  const rotation = (heading * Math.PI) / 180;

  return new Style({
    image: new Icon({
      src: createDroneIconDataUri(status),
      scale: 1,
      rotation: rotation,
      anchor: [0.5, 0.5],
      rotateWithView: true,
    }),
    text: new Text({
      text: `${name}\n${altitude?.toFixed(0) || 0}м • ${
        speed?.toFixed(1) || 0
      }м/с`,
      offsetY: 28,
      font: "bold 11px 'Courier New', monospace",
      fill: new Fill({ color: "#ffffff" }),
      stroke: new Stroke({ color: "#000000", width: 4 }),
      backgroundFill: new Fill({ color: "rgba(0, 0, 0, 0.75)" }),
      padding: [3, 8, 3, 8],
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
    fill: new Fill({
      color: `rgba(${baseColor}, ${isAlarm ? 0.25 : 0.15})`,
    }),
    stroke: new Stroke({
      color: `rgba(${baseColor}, 0.9)`,
      width: isAlarm ? 4 : 3,
    }),
    text: new Text({
      text: isAlarm ? `⚠️ ${name} ⚠️` : name || "ЗОНА",
      font: isAlarm
        ? "bold 18px 'Courier New', monospace"
        : "bold 16px 'Courier New', monospace",
      fill: new Fill({ color: hexColor }),
      stroke: new Stroke({ color: "#000000", width: 6 }),
      backgroundFill: new Fill({
        color: isAlarm ? "rgba(239, 68, 68, 0.25)" : "rgba(0, 0, 0, 0.9)",
      }),
      backgroundStroke: new Stroke({
        color: hexColor,
        width: 2,
      }),
      padding: [10, 16, 10, 16],
    }),
  });
}

function createTrajectoryStyle(): Style {
  return new Style({
    stroke: new Stroke({
      color: "rgba(251, 191, 36, 0.9)",
      width: 5,
      lineCap: "round",
      lineJoin: "round",
    }),
  });
}

const createRulerStyle = (
  feature: FeatureLike,
  selectedVertexIndex: number | null
) => {
  const geometry = feature.getGeometry() as LineString;
  const styles = [
    new Style({
      stroke: new Stroke({
        color: "rgba(0, 255, 255, 0.8)",
        width: 4,
      }),
    }),
  ];

  const coordinates = geometry.getCoordinates();
  for (let i = 0; i < coordinates.length; i++) {
    const isSelected = i === selectedVertexIndex;
    styles.push(
      new Style({
        geometry: new Point(coordinates[i]),
        image: new CircleStyle({
          radius: isSelected ? 10 : 7,
          fill: new Fill({
            color: isSelected
              ? "rgba(255, 0, 0, 0.8)"
              : "rgba(0, 255, 255, 0.8)",
          }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      })
    );
  }

  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    const distance = getGeodesicDistance(toLonLat(p1), toLonLat(p2));
    const text =
      distance < 1000
        ? `${distance.toFixed(0)} м`
        : `${(distance / 1000).toFixed(2)} км`;

    const midpointCoord = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

    styles.push(
      new Style({
        geometry: new Point(midpointCoord),
        text: new Text({
          text: text,
          font: "bold 12px 'Courier New', monospace",
          fill: new Fill({ color: "#00ffff" }),
          stroke: new Stroke({ color: "#000", width: 3 }),
          offsetY: -15,
        }),
      })
    );
  }

  return styles;
};
