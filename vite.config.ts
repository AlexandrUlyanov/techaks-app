import devServer from "@hono/vite-dev-server";
import fs from "fs";
import path from "path";
const __dirname = import.meta.dirname;
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const BUILD_STATIC_ASSETS = [
  "apple-touch-icon.png",
  "favicon.png",
  "favicon.svg",
  "sw.js",
];

function copyBuildStaticAssets() {
  return {
    name: "copy-build-static-assets",
    apply: "build" as const,
    closeBundle() {
      const publicRoot = path.resolve(__dirname, "public");
      const distPublicRoot = path.resolve(__dirname, "dist/public");

      for (const assetName of BUILD_STATIC_ASSETS) {
        const source = path.resolve(publicRoot, assetName);
        const target = path.resolve(distPublicRoot, assetName);

        if (!fs.existsSync(source)) continue;
        fs.copyFileSync(source, target);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    react(),
    copyBuildStaticAssets(),
  ],
  publicDir: command === "build" ? false : path.resolve(__dirname, "public"),
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      db: path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
}));
