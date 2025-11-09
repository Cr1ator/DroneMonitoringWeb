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

// Регистрация компонентов Chart.js
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
}) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDroneHistory();
  }, [drone.id]);

  const loadDroneHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5216/api/drones/${drone.id}/history?limit=20`
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

  // ✅ ИСПРАВЛЕНО #6: График высоты с использованием Chart.js
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

  // ✅ ИСПРАВЛЕНО #6: График скорости с использованием Chart.js
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

  // Общие настройки для графиков
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
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
    <div className="absolute bottom-4 right-4 w-96 military-panel rounded-lg shadow-2xl overflow-hidden">
      {/* Заголовок */}
      <div
        className={`px-4 py-3 ${
          drone.status === "Active"
            ? "bg-green-500/20 border-green-500"
            : "bg-red-500/20 border-red-500"
        } border-b-2`}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold flex items-center text-white">
            <svg
              className="w-5 h-5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
            {drone.name}
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
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
        <div
          className={`text-sm mt-1 font-semibold ${
            drone.status === "Active"
              ? "text-green-400 status-active"
              : "text-red-400"
          }`}
        >
          ● Статус: {drone.status === "Active" ? "АКТИВЕН" : "НЕАКТИВЕН"}
        </div>
      </div>

      {/* Текущие параметры */}
      <div className="p-4 bg-gray-900/30">
        <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase">
          Текущие параметры
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/50 p-3 rounded border border-green-500/20">
            <div className="text-xs text-gray-500">Координаты</div>
            <div className="text-sm font-medium mt-1 tech-font text-green-400">
              {drone.latitude.toFixed(6)}, {drone.longitude.toFixed(6)}
            </div>
          </div>
          <div className="bg-gray-800/50 p-3 rounded border border-green-500/20">
            <div className="text-xs text-gray-500">Высота</div>
            <div className="text-sm font-medium mt-1 tech-font text-green-400">
              {formatAltitude(drone.altitude)}
            </div>
          </div>
          <div className="bg-gray-800/50 p-3 rounded border border-green-500/20">
            <div className="text-xs text-gray-500">Скорость</div>
            <div className="text-sm font-medium mt-1 tech-font text-green-400">
              {formatSpeed(drone.speed)}
            </div>
          </div>
          <div className="bg-gray-800/50 p-3 rounded border border-green-500/20">
            <div className="text-xs text-gray-500">Курс</div>
            <div className="text-sm font-medium mt-1 tech-font text-green-400">
              {formatHeading(drone.heading)}
            </div>
          </div>
        </div>

        {/* Дополнительная информация */}
        <div className="mt-3 pt-3 border-t border-green-500/20">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Частота:</span>
            <span className="font-medium tech-font text-green-400">
              {drone.frequency}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="text-gray-500">Последнее обновление:</span>
            <span className="font-medium tech-font text-green-400">
              {formatDate(drone.lastSeen)}
            </span>
          </div>
        </div>
      </div>

      {/* ✅ ИСПРАВЛЕНО #6: Улучшенные графики с Chart.js */}
      {history.length > 0 && (
        <div className="p-4 bg-gray-900/50 border-t border-green-500/20 space-y-3">
          {/* График высоты */}
          <div className="bg-gray-800/50 rounded p-3 border border-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs text-gray-400 uppercase font-semibold">
                График высоты
              </h4>
              <div className="flex items-center space-x-3 text-xs tech-font">
                <span className="text-green-400">
                  Макс: {Math.max(...history.map((h) => h.altitude)).toFixed(0)}
                  м
                </span>
                <span className="text-blue-400">
                  Мин: {Math.min(...history.map((h) => h.altitude)).toFixed(0)}м
                </span>
              </div>
            </div>
            <div className="h-24">
              <Line data={altitudeChartData} options={chartOptions} />
            </div>
          </div>

          {/* График скорости */}
          <div className="bg-gray-800/50 rounded p-3 border border-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs text-gray-400 uppercase font-semibold">
                График скорости
              </h4>
              <div className="flex items-center space-x-3 text-xs tech-font">
                <span className="text-yellow-400">
                  Макс: {Math.max(...history.map((h) => h.speed)).toFixed(1)}м/с
                </span>
                <span className="text-orange-400">
                  Мин: {Math.min(...history.map((h) => h.speed)).toFixed(1)}м/с
                </span>
              </div>
            </div>
            <div className="h-24">
              <Line data={speedChartData} options={chartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* История полётов */}
      <div className="p-4 max-h-64 overflow-y-auto military-scroll border-t border-green-500/20">
        <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase">
          История полётов (последние 20)
        </h4>

        {loading ? (
          <div className="text-center py-4 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
            <p className="mt-2 text-sm">Загрузка...</p>
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-2">
            {history.map((point, index) => (
              <div
                key={index}
                className="bg-gray-800/50 p-2 rounded text-xs border border-green-500/10 hover:border-green-500/30 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 tech-font">
                    {formatDate(point.timestamp)}
                  </span>
                  <div className="flex space-x-3">
                    <span title="Высота" className="text-green-400 tech-font">
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
                <div className="text-gray-500 mt-1 tech-font">
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            История полётов недоступна
          </p>
        )}
      </div>
    </div>
  );
};
