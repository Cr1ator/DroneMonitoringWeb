import React, { useState } from "react";
import {
  FaRulerCombined,
  FaCopy,
  FaTimes,
  FaCheck,
  FaUndo,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import { LuMousePointerClick, LuPlus } from "react-icons/lu";
import { BsThreeDotsVertical } from "react-icons/bs";

interface RulerData {
  totalDistance: number;
  segmentDistances: number[];
  coordinates: { lon: number; lat: number }[];
}

interface RulerControlProps {
  rulerData: RulerData | null;
  isDrawing: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onContinueDrawing: () => void;
  onFinishDrawing: () => void;
  onUndo: () => void;
  onToggleCollapse: () => void;
}

export const RulerControl: React.FC<RulerControlProps> = ({
  rulerData,
  isDrawing,
  isCollapsed,
  onClose,
  onContinueDrawing,
  onFinishDrawing,
  onUndo,
  onToggleCollapse,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const formatDistance = (d: number) => {
    if (d < 1000) {
      return `${d.toFixed(1)} м`;
    }
    return `${(d / 1000).toFixed(2)} км`;
  };

  const handleCopy = () => {
    if (!rulerData) return;
    // ... (логика копирования без изменений)
    const { totalDistance, segmentDistances, coordinates } = rulerData;
    let copyText = `--- Данные измерений ---\nОбщая дистанция: ${formatDistance(
      totalDistance
    )}\n\nКоличество точек: ${coordinates.length}\n\nСегменты:\n`;
    segmentDistances.forEach((dist, i) => {
      copyText += `  ${i + 1}. Точка ${i + 1} -> Точка ${
        i + 2
      }: ${formatDistance(dist)}\n`;
    });
    copyText += `\nКоординаты (Lon, Lat):\n`;
    coordinates.forEach((coord, i) => {
      copyText += `  Точка ${i + 1}: ${coord.lon.toFixed(
        6
      )}, ${coord.lat.toFixed(6)}\n`;
    });
    navigator.clipboard.writeText(copyText).then(() => {
      alert("Данные скопированы в буфер обмена!");
    });
    setIsMoreMenuOpen(false);
  };

  const hasData = rulerData && rulerData.coordinates.length > 0;

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 military-button p-2 rounded-lg text-green-400 shadow-lg"
        title="Развернуть измерения"
      >
        <FaChevronUp className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-[90vw] max-w-md animate-slideInUp">
      <div className="military-panel rounded-lg shadow-2xl p-3">
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-green-500/20">
          <h3 className="text-base font-bold text-green-400 flex items-center">
            <FaRulerCombined className="w-4 h-4 mr-2" />
            Измерения
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleCollapse}
              className="military-button p-2 rounded text-gray-400"
              title="Свернуть"
            >
              <FaChevronDown className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="military-button p-2 rounded text-gray-400"
                title="Действия"
              >
                <BsThreeDotsVertical className="w-4 h-4" />
              </button>
              {isMoreMenuOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-40 bg-gray-800 border border-green-500/30 rounded-md shadow-lg z-10">
                  {hasData && isDrawing && (
                    <button
                      onClick={() => {
                        onUndo();
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-yellow-300 hover:bg-gray-700 flex items-center"
                    >
                      <FaUndo className="w-4 h-4 mr-2" /> Отменить
                    </button>
                  )}
                  {hasData && (
                    <button
                      onClick={handleCopy}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                    >
                      <FaCopy className="w-4 h-4 mr-2" /> Копировать
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="military-button p-2 rounded text-red-400"
              title="Закрыть линейку"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <LuMousePointerClick className="w-8 h-8 text-green-400 mb-2" />
            <p className="text-gray-300">
              Коснитесь карты, чтобы поставить точку.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Нажмите "Завершить", когда закончите.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-2">
              <span className="text-xs text-gray-400 uppercase">
                Общая дистанция
              </span>
              <p className="text-2xl font-bold text-white tech-font">
                {formatDistance(rulerData.totalDistance)}
              </p>
            </div>
            <div className="h-20 md:h-24 overflow-y-auto military-scroll pr-2 space-y-1">
              {rulerData.segmentDistances.map((dist, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-xs tech-font p-1 rounded bg-gray-800/50"
                >
                  <span className="text-gray-300">
                    Точка {index + 1} → {index + 2}
                  </span>
                  <span className="font-bold text-green-300">
                    {formatDistance(dist)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {hasData && (
          <div className="mt-3 pt-3 border-t border-green-500/20">
            {isDrawing ? (
              <button
                onClick={onFinishDrawing}
                className="w-full military-button p-2 rounded text-green-400 flex items-center justify-center text-sm"
              >
                <FaCheck className="w-4 h-4 mr-2" /> Завершить
              </button>
            ) : (
              <button
                onClick={onContinueDrawing}
                className="w-full military-button p-2 rounded text-yellow-400 flex items-center justify-center text-sm"
              >
                <LuPlus className="w-4 h-4 mr-2" /> Продолжить
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
