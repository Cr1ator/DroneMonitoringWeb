import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5216",
        changeOrigin: true,
        secure: false,
      },
      "/droneHub": {
        target: "http://localhost:5216",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
