import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages 把手机版挂在 /last-order/m/：CI 传 VITE_BASE，本地与 PWA 预览保持 "/"。
  base: process.env.VITE_BASE || "/",
  build: {
    outDir: "dist/client",
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  plugins: [react()],
});
