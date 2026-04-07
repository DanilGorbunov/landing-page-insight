import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 3001,
    /** Fail fast if 3001 is taken instead of picking another port. */
    strictPort: true,
    /** Dev: browser uses same-origin `/api/*`; backend runs on 3000 (see `npm run dev:backend` / `dev:all`). */
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
