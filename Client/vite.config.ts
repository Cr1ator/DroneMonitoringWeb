import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения
  const env = loadEnv(mode, process.cwd(), '');
  
  // Используем переменные окружения или fallback для локальной разработки
  const apiTarget = env.VITE_API_URL || 'http://localhost:5216';
  
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/droneHub": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          ws: true, // WebSocket support для SignalR
        },
      },
    },
    // Для production сборки не нужен proxy
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
