import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./app"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            // console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // console.log('Sending Request to Target:', req.method, req.url);
            // console.log('  Headers:', proxyReq.getHeaders());
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // console.log('Received Response from Target:', proxyRes.statusCode, req.url);
          });
        }
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'app/entry.client.tsx'),
      },
    },
  },
  appType: "spa",
  base: "/",
});
