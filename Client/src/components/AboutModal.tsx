import React from "react";
import { MdClose, MdInfo } from "react-icons/md";
import { FaGithub, FaTelegram, FaEnvelope } from "react-icons/fa";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // ИСПРАВЛЕНО: Функция для остановки всплытия события
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    // ИСПРАВЛЕНО: Добавлен onClick для закрытия по клику на фон
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="military-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto military-scroll animate-modal-in shadow-2xl shadow-green-500/10"
        onClick={handleContentClick}
      >
        <div className="military-header flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <MdInfo className="w-7 h-7 text-green-400" />
            <h2 className="text-xl font-bold text-green-400 tech-font tracking-widest">
              О ПРОЕКТЕ
            </h2>
          </div>
          {/* ИСПРАВЛЕНО: Кнопка теперь квадратная (rounded), а не круглая (rounded-full) */}
          <button
            onClick={onClose}
            className="military-button p-2 rounded"
            title="Закрыть"
          >
            <MdClose className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="bg-yellow-900/30 border-2 border-yellow-500/60 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="text-yellow-400 text-3xl mt-1">⚠️</div>
              <div>
                <h3 className="text-yellow-300 font-bold text-base uppercase tracking-wider mb-2">
                  Важное уведомление
                </h3>
                <p className="text-yellow-200 text-sm leading-relaxed">
                  Это демонстрационное приложение.{" "}
                  <strong>Все данные являются симулированными</strong> и не
                  отражают реальные полеты. Проект создан в образовательных и
                  демонстрационных целях.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-green-400 font-bold text-sm uppercase tracking-wider border-b-2 border-green-500/30 pb-2">
              Описание
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Система мониторинга дронов в реальном времени, демонстрирующая
              возможности отслеживания, визуализации траекторий и основных
              параметров полета с использованием современных веб-технологий.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-800/50 rounded p-3 border border-green-500/20">
                <h4 className="text-green-400 font-semibold mb-2 text-xs uppercase">
                  Frontend
                </h4>
                <ul className="text-gray-300 text-xs space-y-1 tech-font">
                  <li>• React + TypeScript</li>
                  <li>• OpenLayers (Картография)</li>
                  <li>• SignalR (WebSocket)</li>
                  <li>• Tailwind CSS</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 rounded p-3 border border-green-500/20">
                <h4 className="text-green-400 font-semibold mb-2 text-xs uppercase">
                  Backend
                </h4>
                <ul className="text-gray-300 text-xs space-y-1 tech-font">
                  <li>• ASP.NET Core</li>
                  <li>• SignalR Hub</li>
                  <li>• Entity Framework Core</li>
                  <li>• PostgreSQL</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-green-400 font-bold text-sm uppercase tracking-wider border-b-2 border-green-500/30 pb-2">
              Автор
            </h3>

            <div className="bg-gray-900/50 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/50 to-gray-700 flex items-center justify-center text-green-300 text-2xl font-bold tech-font border-2 border-green-500/50">
                  D
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">
                    Dmitry Doshchachka
                  </h4>
                  <p className="text-gray-400 text-sm">Full-Stack Developer</p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {
                    icon: FaGithub,
                    label: "GitHub",
                    value: "github.com/Cr1ator",
                    href: "https://github.com/Cr1ator",
                    hoverColor: "group-hover:text-white",
                  },
                  {
                    icon: FaTelegram,
                    label: "Telegram",
                    value: "@YAKUNARY",
                    href: "https://t.me/YAKUNARY",
                    hoverColor: "group-hover:text-blue-400",
                  },
                  {
                    icon: FaEnvelope,
                    label: "Email",
                    value: "dmitrydoshchachka@gmail.com",
                    href: "mailto:dmitrydoshchachka@gmail.com",
                    hoverColor: "group-hover:text-green-400",
                  },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-800/50 rounded hover:bg-gray-800/80 hover:border-green-500/50 border border-transparent transition-all group"
                  >
                    <item.icon
                      className={`w-5 h-5 text-gray-400 transition-colors ${item.hoverColor}`}
                    />
                    <div className="flex-1">
                      <div className="text-gray-400 text-xs">{item.label}</div>
                      <div className="text-white text-sm tech-font break-all">
                        {item.value}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* ИСПРАВЛЕНО: Футер упрощен и обновлена дата */}
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 mt-6">
            <div className="text-gray-500 text-xs text-center">
              <p>© 2025 Dmitry Doshchachka.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
