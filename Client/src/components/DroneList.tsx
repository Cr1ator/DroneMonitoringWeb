import React, { useState } from "react";
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
      {/* Заголовок */}
      <div className="military-header px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-green-400 font-bold flex items-center text-sm">
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
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
            <svg
              className="w-12 h-12 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
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
                {/* Заголовок дрона */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {/* Иконка дрона */}
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
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
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

                  {/* Кнопка отслеживания */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDroneTrack(drone.id);
                    }}
                    className="military-button p-1.5 rounded text-green-400 hover:text-white"
                    title="Отследить на карте"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
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

                {/* Дополнительная информация */}
                <div className="mt-2 pt-2 border-t border-green-500/10">
                  <div className="flex items-center justify-between text-xs">
                    <div className="text-gray-500">
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
