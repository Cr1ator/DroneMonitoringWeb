import React from "react";
import {
  FaRulerCombined,
  FaCopy,
  FaTimes,
  FaCheck,
  FaUndo,
} from "react-icons/fa";
import { LuMousePointerClick, LuPlus } from "react-icons/lu";

interface RulerData {
  totalDistance: number;
  segmentDistances: number[];
  coordinates: { lon: number; lat: number }[];
}

interface RulerControlProps {
  rulerData: RulerData | null;
  isDrawing: boolean;
  onClose: () => void;
  onContinueDrawing: () => void;
  onFinishDrawing: () => void;
  onUndo: () => void;
}

export const RulerControl: React.FC<RulerControlProps> = ({
  rulerData,
  isDrawing,
  onClose,
  onContinueDrawing,
  onFinishDrawing,
  onUndo,
}) => {
  const formatDistance = (d: number) => {
    if (d < 1000) {
      return `${d.toFixed(1)} м`;
    }
    return `${(d / 1000).toFixed(2)} км`;
  };

  const handleCopy = () => {
    if (!rulerData) return;
    const { totalDistance, segmentDistances, coordinates } = rulerData;

    let copyText = `--- Данные измерений ---\n`;
    copyText += `Общая дистанция: ${formatDistance(totalDistance)}\n\n`;
    copyText += `Количество точек: ${coordinates.length}\n\n`;
    copyText += `Сегменты:\n`;
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
  };

  const hasData = rulerData && rulerData.coordinates.length > 0;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-[90vw] max-w-md animate-slideInRight">
      <div className="military-panel rounded-lg shadow-2xl p-3">
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-green-500/20">
          <h3 className="text-base font-bold text-green-400 flex items-center">
            <FaRulerCombined className="w-4 h-4 mr-2" />
            Измерения
          </h3>
          <div className="flex items-center space-x-2">
            {hasData && isDrawing && (
              <button
                onClick={onUndo}
                className="military-button p-2 rounded text-yellow-400 flex items-center text-xs"
                title="Отменить последнюю точку"
              >
                <FaUndo className="w-4 h-4 mr-1" />
                Отменить
              </button>
            )}
            {hasData && isDrawing && (
              <button
                onClick={onFinishDrawing}
                className="military-button p-2 rounded text-green-400 flex items-center text-xs"
                title="Завершить рисование"
              >
                <FaCheck className="w-4 h-4 mr-1" />
                Завершить
              </button>
            )}
            {hasData && !isDrawing && (
              <button
                onClick={onContinueDrawing}
                className="military-button p-2 rounded text-green-400 flex items-center text-xs"
                title="Продолжить рисование"
              >
                <LuPlus className="w-4 h-4 mr-1" />
                Продолжить
              </button>
            )}
            {hasData && (
              <button
                onClick={handleCopy}
                className="military-button p-2 rounded text-green-400"
                title="Копировать данные"
              >
                <FaCopy className="w-4 h-4" />
              </button>
            )}
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

            <div className="text-xs text-gray-400 text-center mb-1">
              Сегменты ({rulerData.segmentDistances.length} шт.)
            </div>
            <div className="max-h-24 overflow-y-auto military-scroll pr-2">
              {rulerData.segmentDistances.map((dist, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-xs tech-font p-1 rounded bg-gray-800/50 mb-1"
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
      </div>
    </div>
  );
};
