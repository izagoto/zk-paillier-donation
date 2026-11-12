import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfill";

export default defineConfig({
  plugins: [nodePolyfills({ globals: { Buffer: true, process: true } })],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});
