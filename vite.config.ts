import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { firebase: ["firebase/app", "firebase/firestore"], charts: ["recharts"] },
      },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
