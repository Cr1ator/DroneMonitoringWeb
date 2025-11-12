import React from "react";
import { FaArrowsAlt, FaTrash, FaTimes } from "react-icons/fa";

interface RulerEditPanelProps {
  isVisible: boolean;
  onMove: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}

export const RulerEditPanel: React.FC<RulerEditPanelProps> = ({
  isVisible,
  onMove,
  onDelete,
  onDeselect,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-20 w-auto animate-slideInRight">
      <div className="military-panel rounded-lg shadow-2xl p-2 flex items-center space-x-2">
        <button
          onClick={onMove}
          className="military-button p-3 rounded text-green-400 flex items-center"
          title="Переместить точку"
        >
          <FaArrowsAlt className="w-5 h-5" />
        </button>
        <button
          onClick={onDelete}
          className="military-button p-3 rounded text-red-400 flex items-center"
          title="Удалить точку"
        >
          <FaTrash className="w-5 h-5" />
        </button>
        <div className="w-px h-8 bg-gray-600 mx-1"></div>
        <button
          onClick={onDeselect}
          className="military-button p-2 rounded text-gray-400"
          title="Отменить выбор"
        >
          <FaTimes className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
