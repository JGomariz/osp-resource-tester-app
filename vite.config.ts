/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Tauri dev expects a fixed port and no screen clearing.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
