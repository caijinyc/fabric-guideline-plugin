import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: ["esnext"],
    lib: {
      entry: "./src/index.ts",
      formats: ["cjs", "es", "umd"],
      name: "fabric-guideline",
      fileName: "index",
    },
    rollupOptions: {
      external: ["fabric"],
    },
  },
});
