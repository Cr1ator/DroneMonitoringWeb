import React, { useEffect, useState } from "react";
import type { DroneHistory } from "../types/drone";

interface DroneHistoryPanelProps {
  droneId: number;
  droneName: string;
  onClose: () => void;
}

export const DroneHistoryPanel: React.FC<DroneHistoryPanelProps> = ({
  droneId,
  droneName,
  onClose,
}) => {
  const [history, setHistory] = useState<DroneHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<1 | 6 | 24>(1);

  useEffect(() => {
    loadHistory();
  }, [droneId, timeRange]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5216/api/drones/${droneId}/history?hours=${timeRange}&limit=50`
      );
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Error loading drone history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getDirectionName = (heading: number) => {
    const directions = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  const calculateStats = () => {
    if (history.length === 0) return null;

    const altitudes = history.map((h) => h.altitude);
    const speeds = history.map((h) => h.speed);

    return {
      maxAltitude: Math.max(...altitudes),
      minAltitude: Math.min(...altitudes),
      avgAltitude: altitudes.reduce((a, b) => a + b, 0) / altitudes.length,
      maxSpeed: Math.max(...speeds),
      minSpeed: Math.min(...speeds),
      avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
      totalPoints: history.length,
    };
  };

  const stats = calculateStats();

  return (
    <div className="fixed inset-y-0 right-0 w-96 military-panel shadow-2xl flex flex-col z-50 animate-slideInRight">
      {/* Заголовок */}
      <div className="military-header px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-green-400 font-bold text-sm flex items-center">
              <svg
                className="w-5 h-5 mr-2"
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
              ИСТОРИЯ ПОЛЁТА
            </h2>
            <div className="text-xs text-gray-400 tech-font mt-1">
              {droneName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Выбор временного диапазона */}
      <div className="px-4 py-3 bg-gray-900/50 border-b border-green-500/20">
        <div className="text-xs text-gray-400 mb-2 uppercase">
          Временной диапазон
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 6, 24].map((hours) => (
            <button
              key={hours}
              onClick={() => setTimeRange(hours as 1 | 6 | 24)}
              className={`
                px-3 py-2 rounded text-xs font-semibold transition-all
                ${
                  timeRange === hours
                    ? "bg-green-500/30 text-green-400 border border-green-500"
                    : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
                }
              `}
            >
              {hours}ч
            </button>
          ))}
        </div>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="px-4 py-3 bg-gray-900/30 border-b border-green-500/20">
          <div className="text-xs text-gray-400 mb-2 uppercase">Статистика</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-xs text-gray-500">Макс. высота</div>
              <div className="text-sm text-green-400 font-semibold tech-font">
                {stats.maxAltitude.toFixed(0)}м
              </div>
            </div>
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-xs text-gray-500">Средняя высота</div>
              <div className="text-sm text-green-400 font-semibold tech-font">
                {stats.avgAltitude.toFixed(0)}м
              </div>
            </div>
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-xs text-gray-500">Макс. скорость</div>
              <div className="text-sm text-green-400 font-semibold tech-font">
                {stats.maxSpeed.toFixed(1)}м/с
              </div>
            </div>
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-xs text-gray-500">Средняя скорость</div>
              <div className="text-sm text-green-400 font-semibold tech-font">
                {stats.avgSpeed.toFixed(1)}м/с
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500 text-center">
            Всего точек:{" "}
            <span className="text-green-400 tech-font">
              {stats.totalPoints}
            </span>
          </div>
        </div>
      )}

      {/* Список истории */}
      <div className="flex-1 overflow-y-auto military-scroll px-4 py-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            <p className="text-sm text-gray-400 mt-3">Загрузка данных...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg
              className="w-16 h-16 mb-3 opacity-50"
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
            <p className="text-sm">Нет данных за выбранный период</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((point, index) => (
              <div
                key={index}
                className="bg-gray-800/50 border border-green-500/20 rounded p-3 hover:bg-gray-800/70 transition-colors"
              >
                {/* Время */}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-green-400 tech-font font-semibold">
                    {formatDateTime(point.timestamp)}
                  </div>
                  {index === 0 && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                      ПОСЛЕДНЕЕ
                    </span>
                  )}
                </div>

                {/* Параметры */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <div className="text-xs text-gray-500">Высота</div>
                    <div className="text-xs text-white font-semibold tech-font">
                      {point.altitude.toFixed(0)}м
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Скорость</div>
                    <div className="text-xs text-white font-semibold tech-font">
                      {point.speed.toFixed(1)}м/с
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Курс</div>
                    <div className="text-xs text-white font-semibold tech-font">
                      {point.heading.toFixed(0)}°{" "}
                      {getDirectionName(point.heading)}
                    </div>
                  </div>
                </div>

                {/* Координаты */}
                <div className="text-xs text-gray-500 pt-2 border-t border-green-500/10">
                  <span className="text-gray-400">Позиция:</span>
                  <span className="ml-1 text-green-400 tech-font">
                    {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Подвал */}
      <div className="px-4 py-3 bg-gray-900/50 border-t border-green-500/20">
        <button
          onClick={loadHistory}
          disabled={loading}
          className="w-full military-button py-2 rounded text-green-400 font-semibold text-sm disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Обновление...
            </span>
          ) : (
            <span className="flex items-center justify-center">
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Обновить данные
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
