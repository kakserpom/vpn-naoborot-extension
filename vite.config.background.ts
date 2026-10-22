import { defineConfig } from "vite";

// Фон собирается отдельным classic-скриптом (IIFE), чтобы одинаково работать
// и в Chrome (service_worker), и в Firefox (background.scripts).
export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/background/index.ts",
      name: "vpnNaoborotBackground",
      formats: ["iife"],
      fileName: () => "background.js",
    },
  },
});
