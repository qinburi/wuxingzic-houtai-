import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve("admin"),
  base: "./",
  plugins: [vue()],
  build: {
    outDir: resolve("admin-dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/admin.js",
        assetFileNames: "assets/admin.[ext]"
      }
    }
  }
});
