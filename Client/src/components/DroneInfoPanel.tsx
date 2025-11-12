import React, { useEffect, useState, useRef } from "react";
import type { Drone } from "../types/drone";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DroneInfoPanelProps {
  drone: Drone;
  onClose: () => void;
  isListVisible: boolean;
}

interface HistoryPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export const DroneInfoPanel: React.FC<DroneInfoPanelProps> = ({
  drone,
  onClose,
  isListVisible,
}) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const autoReloadIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadDroneHistory();

    autoReloadIntervalRef.current = setInterval(() => {
      loadDroneHistory();
    }, 3000);

    console.log("✅ Auto-reload interval started for drone:", drone.id);

    return () => {
      if (autoReloadIntervalRef.current) {
        clearInterval(autoReloadIntervalRef.current);
        console.log("🧹 Auto-reload interval cleared");
      }
    };
  }, [drone.id]);

  const loadDroneHistory = async () => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(
        `${apiUrl}/api/drones/${drone.id}/history?limit=20`
      );
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
        console.log("🔄 Drone history reloaded:", data.length, "points");
      }
    } catch (error) {
      console.error("Error loading drone history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  };

  const formatSpeed = (speed: number) => {
    return `${speed.toFixed(1)} м/с`;
  };

  const formatAltitude = (altitude: number) => {
    return `${altitude.toFixed(0)} м`;
  };

  const formatHeading = (heading: number) => {
    const directions = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
    const index = Math.round(heading / 45) % 8;
    return `${heading.toFixed(0)}° (${directions[index]})`;
  };

  const altitudeChartData = {
    labels: history.map((_, index) => index).reverse(),
    datasets: [
      {
        label: "Высота (м)",
        data: history.map((h) => h.altitude).reverse(),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const speedChartData = {
    labels: history.map((_, index) => index).reverse(),
    datasets: [
      {
        label: "Скорость (м/с)",
        data: history.map((h) => h.speed).reverse(),
        borderColor: "rgb(251, 191, 36)",
        backgroundColor: "rgba(251, 191, 36, 0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderColor: "rgba(34, 197, 94, 0.5)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        beginAtZero: false,
        grid: {
          color: "rgba(34, 197, 94, 0.1)",
        },
        ticks: {
          color: "rgba(34, 197, 94, 0.8)",
          font: {
            family: "'Courier New', monospace",
            size: 10,
          },
        },
      },
    },
  };

  return (
    <div
      className={`
      bg-gray-900 h-full
      transition-all duration-300 ease-in-out
      fixed inset-y-0 right-0 z-50 w-full sm:w-96
      transform translate-x-0
      lg:fixed lg:bottom-2 lg:right-2 lg:left-2
      lg:md:bottom-4 lg:md:left-auto ${
        isListVisible ? "lg:right-[25rem]" : "lg:md:right-4"
      }
      lg:w-auto lg:md:w-96
      lg:h-auto lg:max-h-[80vh] lg:md:max-h-[calc(100vh-6rem)]
      lg:inset-y-auto lg:transform-none
      military-panel rounded-none lg:rounded-lg shadow-2xl
      flex flex-col overflow-hidden
    `}
    >
      {/* Заголовок */}
      <div
        className={`px-3 py-2 md:px-4 md:py-3 shrink-0 ${
          drone.status === "Active"
            ? "bg-green-500/20 border-green-500"
            : "bg-red-500/20 border-red-500"
        } border-b-2`}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-base md:text-lg font-bold flex items-center text-white">
            <svg
              className="w-4 h-4 md:w-5 md:h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
            <span className="truncate">{drone.name}</span>
          </h3>
          {/* Кнопка закрытия для десктопа */}
          <button
            onClick={onClose}
            className="hidden lg:block military-button p-2 rounded text-gray-400 hover:text-white ml-2"
            title="Закрыть"
          >
            <svg
              className="w-5 h-5"
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
        <div
          className={`text-xs md:text-sm mt-1 font-semibold ${
            drone.status === "Active"
              ? "text-green-400 status-active"
              : "text-red-400"
          }`}
        >
          ● Статус: {drone.status === "Active" ? "АКТИВЕН" : "НЕАКТИВЕН"}
        </div>
        <div className="text-xs text-gray-400 mt-1 flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          Автообновление каждые 3 сек
        </div>
      </div>

      {/* Контейнер для контента с общей прокруткой */}
      <div className="grow overflow-y-auto subtle-scroll">
        {/* Текущие параметры */}
        <div className="p-3 md:p-4 bg-gray-900/30">
          <h4 className="text-xs font-semibold text-gray-400 mb-2 md:mb-3 uppercase">
            Текущие параметры
          </h4>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div className="bg-gray-800/50 p-2 md:p-3 rounded border border-green-500/20">
              <div className="text-xs text-gray-500">Координаты</div>
              <div className="text-xs md:text-sm font-medium mt-1 tech-font text-green-400 break-all">
                {drone.latitude.toFixed(6)}, {drone.longitude.toFixed(6)}
              </div>
            </div>
            <div className="bg-gray-800/50 p-2 md:p-3 rounded border border-green-500/20">
              <div className="text-xs text-gray-500">Высота</div>
              <div className="text-xs md:text-sm font-medium mt-1 tech-font text-green-400">
                {formatAltitude(drone.altitude)}
              </div>
            </div>
            <div className="bg-gray-800/50 p-2 md:p-3 rounded border border-green-500/20">
              <div className="text-xs text-gray-500">Скорость</div>
              <div className="text-xs md:text-sm font-medium mt-1 tech-font text-green-400">
                {formatSpeed(drone.speed)}
              </div>
            </div>
            <div className="bg-gray-800/50 p-2 md:p-3 rounded border border-green-500/20">
              <div className="text-xs text-gray-500">Курс</div>
              <div className="text-xs md:text-sm font-medium mt-1 tech-font text-green-400">
                {formatHeading(drone.heading)}
              </div>
            </div>
          </div>

          {/* Дополнительная информация */}
          <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-green-500/20">
            <div className="flex justify-between items-center text-xs md:text-sm">
              <span className="text-gray-500">Частота:</span>
              <span className="font-medium tech-font text-green-400">
                {drone.frequency}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs md:text-sm mt-2">
              <span className="text-gray-500">Последнее обновление:</span>
              <span className="font-medium tech-font text-green-400 text-right">
                {formatDate(drone.lastSeen)}
              </span>
            </div>
          </div>
        </div>

        {/* Графики */}
        {history.length > 0 && (
          <div className="p-3 md:p-4 bg-gray-900/50 border-t border-green-500/20 space-y-3">
            {/* График высоты */}
            <div className="bg-gray-800/50 rounded p-2 md:p-3 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs text-gray-400 uppercase font-semibold">
                  График высоты
                </h4>
                <div className="flex items-center space-x-2 md:space-x-3 text-xs tech-font">
                  <span className="text-green-400">
                    Макс:{" "}
                    {Math.max(...history.map((h) => h.altitude)).toFixed(0)}м
                  </span>
                  <span className="text-blue-400">
                    Мин:{" "}
                    {Math.min(...history.map((h) => h.altitude)).toFixed(0)}м
                  </span>
                </div>
              </div>
              <div className="h-20 md:h-24">
                <Line data={altitudeChartData} options={chartOptions} />
              </div>
            </div>

            {/* График скорости */}
            <div className="bg-gray-800/50 rounded p-2 md:p-3 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs text-gray-400 uppercase font-semibold">
                  График скорости
                </h4>
                <div className="flex items-center space-x-2 md:space-x-3 text-xs tech-font">
                  <span className="text-yellow-400">
                    Макс: {Math.max(...history.map((h) => h.speed)).toFixed(1)}
                    м/с
                  </span>
                  <span className="text-orange-400">
                    Мин: {Math.min(...history.map((h) => h.speed)).toFixed(1)}
                    м/с
                  </span>
                </div>
              </div>
              <div className="h-20 md:h-24">
                <Line data={speedChartData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}

        {/* История полётов */}
        <div className="p-3 md:p-4 border-t border-green-500/20">
          <h4 className="text-xs font-semibold text-gray-400 mb-2 md:mb-3 uppercase">
            История полётов (последние 20)
          </h4>

          <div
            className="relative military-scroll overflow-y-auto"
            style={{ minHeight: "256px", maxHeight: "256px" }}
          >
            {loading && history.length > 0 && (
              <div className="absolute inset-0 bg-gray-800/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <div className="text-center text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                  <p className="mt-2 text-sm">Обновление...</p>
                </div>
              </div>
            )}

            {loading && history.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{ height: "240px" }}
              >
                <div className="text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                  <p className="mt-2 text-sm">Загрузка...</p>
                </div>
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-2">
                {history.map((point, index) => (
                  <div
                    key={`${point.timestamp}-${index}`}
                    className="bg-gray-800/50 p-2 rounded text-xs border border-green-500/10 hover:border-green-500/30 transition-colors"
                  >
                    <div className="flex justify-between items-center flex-wrap gap-1">
                      <span className="text-gray-400 tech-font text-xs">
                        {formatDate(point.timestamp)}
                      </span>
                      <div className="flex space-x-2 md:space-x-3 text-xs">
                        <span
                          title="Высота"
                          className="text-green-400 tech-font"
                        >
                          ↑{formatAltitude(point.altitude)}
                        </span>
                        <span
                          title="Скорость"
                          className="text-yellow-400 tech-font"
                        >
                          ➜{formatSpeed(point.speed)}
                        </span>
                        <span title="Курс" className="text-blue-400 tech-font">
                          {point.heading.toFixed(0)}°
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-500 mt-1 tech-font text-xs break-all">
                      {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex items-center justify-center"
                style={{ height: "240px" }}
              >
                <p className="text-sm text-gray-500 text-center py-4">
                  История полётов недоступна
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
