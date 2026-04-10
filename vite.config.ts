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
    /** Dev: browser uses same-origin `/api/*`; backend default port 3002 (see `npm run dev:backend` / `dev:all`). */
    proxy: {
      "/api": {
        /** Use IPv4 loopback so proxy matches Node’s default listen (avoids ::1 vs 127.0.0.1 mismatch on some macOS setups). */
        target: "http://127.0.0.1:3002",
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
