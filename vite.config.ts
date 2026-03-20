import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/chart-component.ts",
      formats: ["es"],
      fileName: "chart-component",
    },
  },
});
