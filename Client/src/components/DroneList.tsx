import React, { useState } from "react";
import { TbDrone } from "react-icons/tb";
import { MdGpsFixed } from "react-icons/md";
import { IoMdRadio } from "react-icons/io";
import type { Drone } from "../types/drone";

interface DroneListProps {
  drones: Drone[];
  selectedDrone: Drone | null;
  onDroneSelect: (drone: Drone) => void;
  onDroneTrack: (droneId: number) => void;
}

export const DroneList: React.FC<DroneListProps> = ({
  drones,
  selectedDrone,
  onDroneSelect,
  onDroneTrack,
}) => {
  const [sortBy, setSortBy] = useState<"name" | "altitude" | "speed">("name");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "Active" | "Inactive"
  >("all");

  const filteredDrones = drones
    .filter((drone) => filterStatus === "all" || drone.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "altitude":
          return b.altitude - a.altitude;
        case "speed":
          return b.speed - a.speed;
        default:
          return 0;
      }
    });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="military-panel rounded-lg overflow-hidden flex flex-col h-full">
      {/* Заголовок - ТОЛЬКО ЗАМЕНИЛИ ИКОНКУ */}
      <div className="military-header px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-green-400 font-bold flex items-center text-sm">
            <TbDrone className="w-5 h-5 mr-2" />
            АКТИВНЫЕ ДРОНЫ
          </h2>
          <div className="tech-font text-green-400 text-xs">
            {filteredDrones.length} / {drones.length}
          </div>
        </div>
      </div>

      {/* Фильтры и сортировка */}
      <div className="px-4 py-2 bg-gray-900/50 border-b border-green-500/20">
        <div className="flex items-center justify-between space-x-2">
          {/* Фильтр статуса */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-gray-800 text-green-400 text-xs border border-green-500/50 rounded px-2 py-1 focus:outline-none focus:border-green-500"
          >
            <option value="all">Все</option>
            <option value="Active">Активные</option>
            <option value="Inactive">Неактивные</option>
          </select>

          {/* Сортировка */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-gray-800 text-green-400 text-xs border border-green-500/50 rounded px-2 py-1 focus:outline-none focus:border-green-500"
          >
            <option value="name">По имени</option>
            <option value="altitude">По высоте</option>
            <option value="speed">По скорости</option>
          </select>
        </div>
      </div>

      {/* Список дронов */}
      <div className="flex-1 overflow-y-auto military-scroll">
        {filteredDrones.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <TbDrone className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Дроны не обнаружены</p>
          </div>
        ) : (
          <div className="divide-y divide-green-500/20">
            {filteredDrones.map((drone) => (
              <div
                key={drone.id}
                onClick={() => onDroneSelect(drone)}
                className={`
                  p-3 cursor-pointer transition-all duration-200
                  ${
                    selectedDrone?.id === drone.id
                      ? "bg-green-500/20 border-l-4 border-green-500"
                      : "hover:bg-green-500/10 border-l-4 border-transparent"
                  }
                `}
              >
                {/* Заголовок дрона - ТОЛЬКО ЗАМЕНИЛИ ИКОНКУ */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${
                        drone.status === "Active"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }
                    `}
                    >
                      <TbDrone className="w-5 h-5" />
                    </div>

                    {/* Название и статус */}
                    <div>
                      <div className="text-white font-semibold text-sm tech-font">
                        {drone.name}
                      </div>
                      <div
                        className={`
                        text-xs font-medium
                        ${
                          drone.status === "Active"
                            ? "text-green-400 status-active"
                            : "text-red-400"
                        }
                      `}
                      >
                        ● {drone.status === "Active" ? "АКТИВЕН" : "НЕАКТИВЕН"}
                      </div>
                    </div>
                  </div>

                  {/* Кнопка отслеживания - ЗАМЕНИЛИ ИКОНКУ */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDroneTrack(drone.id);
                    }}
                    className="military-button p-1.5 rounded text-green-400 hover:text-white"
                    title="Отследить на карте"
                  >
                    <MdGpsFixed className="w-4 h-4" />
                  </button>
                </div>

                {/* Телеметрия */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-gray-900/50 rounded px-2 py-1">
                    <div className="text-xs text-gray-500">Высота</div>
                    <div className="text-xs text-green-400 font-semibold tech-font">
                      {drone.altitude.toFixed(0)}м
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded px-2 py-1">
                    <div className="text-xs text-gray-500">Скорость</div>
                    <div className="text-xs text-green-400 font-semibold tech-font">
                      {drone.speed.toFixed(1)}м/с
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded px-2 py-1">
                    <div className="text-xs text-gray-500">Курс</div>
                    <div className="text-xs text-green-400 font-semibold tech-font">
                      {drone.heading.toFixed(0)}°
                    </div>
                  </div>
                </div>

                {/* Дополнительная информация - ЗАМЕНИЛИ ИКОНКУ */}
                <div className="mt-2 pt-2 border-t border-green-500/10">
                  <div className="flex items-center justify-between text-xs">
                    <div className="text-gray-500 flex items-center">
                      <IoMdRadio className="w-3 h-3 mr-1" />
                      <span className="text-gray-400">Частота:</span>
                      <span className="ml-1 text-green-400 tech-font">
                        {drone.frequency}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      <span className="text-gray-400">Обновлено:</span>
                      <span className="ml-1 text-green-400 tech-font">
                        {formatTime(drone.lastSeen)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Подвал */}
      <div className="px-4 py-2 bg-gray-900/50 border-t border-green-500/20">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <span>Real-time tracking</span>
          </div>
          <div className="tech-font text-green-400">
            {new Date().toLocaleTimeString("ru-RU")}
          </div>
        </div>
      </div>
    </div>
  );
};
