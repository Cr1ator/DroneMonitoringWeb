import React from "react";

interface MapControlsProps {
  mapType: "osm" | "satellite";
  showZones: boolean;
  showTrajectories: boolean;
  onToggleMapType: () => void;
  onToggleZones: () => void;
  onToggleTrajectories: () => void;
  onCenterMap: () => void;
  onResetZoom: () => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
  mapType,
  showZones,
  showTrajectories,
  onToggleMapType,
  onToggleZones,
  onToggleTrajectories,
  onCenterMap,
  onResetZoom,
}) => {
  return (
    // ✅ ИСПРАВЛЕНИЕ #2: Изменено позиционирование с top-4 left-4 на bottom-4 left-4
    // Теперь панель не перекрывает стандартные кнопки масштабирования OpenLayers
    <div className="absolute bottom-4 left-4 military-panel rounded-lg shadow-lg p-4 min-w-[200px] z-10">
      <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center uppercase tracking-wider">
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
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
        Настройки карты
      </h3>

      <div className="space-y-3">
        {/* Тип карты */}
        <div className="pb-3 border-b border-green-500/20">
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
            Тип карты
          </label>
          <button
            onClick={onToggleMapType}
            className="w-full px-3 py-2 military-button rounded text-green-400 text-sm flex items-center justify-center"
          >
            {mapType === "osm" ? (
              <>
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
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                OpenStreetMap
              </>
            ) : (
              <>
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
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Спутник
              </>
            )}
          </button>
        </div>

        {/* Слои */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
            Слои карты
          </label>

          <div className="space-y-2">
            {/* Зоны покрытия */}
            <label className="flex items-center cursor-pointer hover:bg-gray-700/30 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={showZones}
                onChange={onToggleZones}
                className="mr-3 w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-300 flex items-center flex-1">
                <svg
                  className="w-4 h-4 mr-2 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                Зоны покрытия
              </span>
              {showZones && (
                <span className="text-xs text-green-400 font-medium uppercase">
                  ON
                </span>
              )}
            </label>

            {/* Траектории */}
            <label className="flex items-center cursor-pointer hover:bg-gray-700/30 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={showTrajectories}
                onChange={onToggleTrajectories}
                className="mr-3 w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500"
              />
              <span className="text-sm text-gray-300 flex items-center flex-1">
                <svg
                  className="w-4 h-4 mr-2 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                Траектории
              </span>
              {showTrajectories && (
                <span className="text-xs text-green-400 font-medium uppercase">
                  ON
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Управление картой */}
        <div className="pt-3 border-t border-green-500/20">
          <div className="text-xs text-gray-500 space-y-1 mb-2">
            <div className="flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 15l-2 5L9 9l11 4-5 2z"
                />
              </svg>
              <span>Клик на дрон - детали</span>
            </div>
            <div className="flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Колесико - масштаб</span>
            </div>
            <div className="flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              <span>Перетаскивание - навигация</span>
            </div>
          </div>
        </div>

        {/* ✅ Кнопки быстрых действий */}
        <div className="pt-3 border-t border-green-500/20">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onCenterMap}
              className="px-2 py-2 military-button rounded text-green-400 text-xs font-semibold uppercase tracking-wider hover:bg-green-500/20"
              title="Центрировать карту на Минске"
            >
              📍 Центр
            </button>
            <button
              onClick={onResetZoom}
              className="px-2 py-2 military-button rounded text-green-400 text-xs font-semibold uppercase tracking-wider hover:bg-green-500/20"
              title="Сбросить масштаб"
            >
              🔍 Сброс
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
