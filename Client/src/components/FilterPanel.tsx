import React, { useState } from "react";
import type { DroneFilters, DroneStats } from "../types/drone";

interface FilterPanelProps {
  filters: DroneFilters;
  onFiltersChange: (filters: DroneFilters) => void;
  stats: DroneStats | null;
  isConnected: boolean;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  stats,
  isConnected,
}) => {
  const [localFilters, setLocalFilters] = useState<DroneFilters>(filters);

  const handleStatusChange = (status: string) => {
    const newStatusFilter = localFilters.statusFilter.includes(status)
      ? localFilters.statusFilter.filter((s) => s !== status)
      : [...localFilters.statusFilter, status];

    const newFilters = { ...localFilters, statusFilter: newStatusFilter };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
    console.log("✅ Status filter changed:", newStatusFilter);
  };

  const handleFrequencyChange = (frequency: string) => {
    const newFrequencyFilter = localFilters.frequencyFilter.includes(frequency)
      ? localFilters.frequencyFilter.filter((f) => f !== frequency)
      : [...localFilters.frequencyFilter, frequency];

    const newFilters = { ...localFilters, frequencyFilter: newFrequencyFilter };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
    console.log("✅ Frequency filter changed:", newFrequencyFilter);
  };

  const clearFilters = () => {
    const newFilters = { statusFilter: [], frequencyFilter: [] };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
    console.log("✅ Filters cleared");
  };

  return (
    <div className="w-80 military-panel overflow-y-auto military-scroll flex flex-col h-full">
      {/* Заголовок и статус подключения */}
      <div className="military-header px-4 py-3">
        <h1 className="text-green-400 font-bold mb-2 flex items-center text-sm uppercase">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
          Drone Monitoring
        </h1>
        <div className="flex items-center">
          <span
            className={`inline-block w-3 h-3 rounded-full mr-2 ${
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="p-4 bg-gray-900/50 border-b border-green-500/20">
          <h2 className="text-green-400 font-semibold mb-3 text-xs uppercase tracking-wider flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Статистика
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-800/50 rounded p-3 border border-green-500/20">
              <div className="text-xs text-gray-500 uppercase">Всего</div>
              <div className="text-2xl font-bold text-green-400 tech-font">
                {stats.total}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded p-3 border border-green-500/20">
              <div className="text-xs text-gray-500 uppercase">Активные</div>
              <div className="text-2xl font-bold text-green-400 tech-font status-active">
                {stats.active}
              </div>
            </div>
          </div>

          {stats.byFrequency && stats.byFrequency.length > 0 && (
            <div className="pt-3 border-t border-green-500/20">
              <div className="text-xs text-gray-400 mb-2 uppercase">
                По частоте:
              </div>
              <div className="space-y-1">
                {stats.byFrequency.map((freq: any) => (
                  <div
                    key={freq.frequency}
                    className="flex justify-between text-sm bg-gray-800/30 p-2 rounded"
                  >
                    <span className="text-gray-400 tech-font">
                      {freq.frequency}
                    </span>
                    <span className="text-green-400 font-semibold tech-font">
                      {freq.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Фильтры */}
      <div className="flex-1 p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-green-400 font-semibold text-xs uppercase tracking-wider flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Фильтры
          </h2>
          {(localFilters.statusFilter.length > 0 ||
            localFilters.frequencyFilter.length > 0) && (
            <button
              onClick={clearFilters}
              className="text-xs text-green-400 hover:text-green-300 transition-colors uppercase font-semibold"
            >
              Сбросить
            </button>
          )}
        </div>

        {/* Фильтр по статусу */}
        <div className="mb-4">
          <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase">
            Статус
          </h3>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer hover:bg-gray-700/30 p-3 rounded transition-colors border border-transparent hover:border-green-500/30">
              <input
                type="checkbox"
                checked={localFilters.statusFilter.includes("Active")}
                onChange={() => handleStatusChange("Active")}
                className="mr-3 w-4 h-4 military-checkbox text-green-500 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
              />
              <span className="flex items-center flex-1">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2 status-active"></span>
                <span className="text-sm text-gray-300 font-medium">
                  Активные
                </span>
              </span>
              {stats && (
                <span className="text-xs text-green-400 font-bold tech-font">
                  {stats.active}
                </span>
              )}
            </label>

            <label className="flex items-center cursor-pointer hover:bg-gray-700/30 p-3 rounded transition-colors border border-transparent hover:border-green-500/30">
              <input
                type="checkbox"
                checked={localFilters.statusFilter.includes("Inactive")}
                onChange={() => handleStatusChange("Inactive")}
                className="mr-3 w-4 h-4 military-checkbox text-red-500 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
              />
              <span className="flex items-center flex-1">
                <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                <span className="text-sm text-gray-300 font-medium">
                  Неактивные
                </span>
              </span>
              {stats && (
                <span className="text-xs text-red-400 font-bold tech-font">
                  {stats.inactive}
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Фильтр по частоте */}
        <div className="mb-4">
          <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase">
            Частота
          </h3>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer hover:bg-gray-700/30 p-3 rounded transition-colors border border-transparent hover:border-green-500/30">
              <input
                type="checkbox"
                checked={localFilters.frequencyFilter.includes("2.4 GHz")}
                onChange={() => handleFrequencyChange("2.4 GHz")}
                className="mr-3 w-4 h-4 military-checkbox text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300 font-medium tech-font flex-1">
                2.4 GHz
              </span>
              {stats && stats.byFrequency && (
                <span className="text-xs text-green-400 font-bold tech-font">
                  {stats.byFrequency.find((f: any) => f.frequency === "2.4 GHz")
                    ?.count || 0}
                </span>
              )}
            </label>

            <label className="flex items-center cursor-pointer hover:bg-gray-700/30 p-3 rounded transition-colors border border-transparent hover:border-green-500/30">
              <input
                type="checkbox"
                checked={localFilters.frequencyFilter.includes("5.8 GHz")}
                onChange={() => handleFrequencyChange("5.8 GHz")}
                className="mr-3 w-4 h-4 military-checkbox text-purple-500 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-300 font-medium tech-font flex-1">
                5.8 GHz
              </span>
              {stats && stats.byFrequency && (
                <span className="text-xs text-green-400 font-bold tech-font">
                  {stats.byFrequency.find((f: any) => f.frequency === "5.8 GHz")
                    ?.count || 0}
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Легенда */}
        <div className="mt-6 pt-4 border-t border-green-500/20">
          <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase">
            Легенда
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center p-2 bg-gray-800/30 rounded">
              <span className="w-4 h-4 bg-green-500 rounded-full mr-2 status-active"></span>
              <span className="text-gray-400">Активный дрон</span>
            </div>
            <div className="flex items-center p-2 bg-gray-800/30 rounded">
              <span className="w-4 h-4 bg-red-500 rounded-full mr-2"></span>
              <span className="text-gray-400">Неактивный дрон</span>
            </div>
            <div className="flex items-center p-2 bg-gray-800/30 rounded">
              <div className="w-4 h-4 bg-green-500/30 border-2 border-green-500 rounded-full mr-2"></div>
              <span className="text-gray-400">Зона покрытия</span>
            </div>
            <div className="flex items-center p-2 bg-gray-800/30 rounded">
              <div className="w-6 h-1 bg-yellow-500 mr-2 rounded"></div>
              <span className="text-gray-400">Траектория полёта</span>
            </div>
          </div>
        </div>
      </div>

      {/* Подвал */}
      <div className="px-4 py-3 bg-gray-900/50 border-t border-green-500/20">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center justify-between">
            <span>Real-time tracking</span>
            <span className="text-green-400 tech-font">
              {new Date().toLocaleTimeString("ru-RU")}
            </span>
          </div>
          <p className="text-gray-600">Кликните на дрон для деталей</p>
        </div>
      </div>
    </div>
  );
};
