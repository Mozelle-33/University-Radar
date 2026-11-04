import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Match the native iOS deployment target instead of Vite's newer default.
  build: { target: ["chrome111", "edge111", "firefox114", "safari15", "ios15"] },
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/android/**", "**/ios/**"] },
  },
});
