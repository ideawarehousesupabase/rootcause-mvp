import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

/** In development, serve api/read-job-advert.ts the way Vercel does in production. */
function jobAdvertApi(): Plugin {
  return {
    name: "job-advert-api",
    configureServer(server) {
      server.middlewares.use("/api/read-job-advert", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const mod = await server.ssrLoadModule("/api/read-job-advert.ts");
        const request = new Request(`http://${req.headers.host}/api/read-job-advert`, {
          method: "POST",
          headers: Object.entries(req.headers).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
          body: Buffer.concat(chunks),
        });
        const response: Response = await mod.POST(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), jobAdvertApi()],
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
  test: { environment: "node", include: ["src/**/*.test.ts", "api/**/*.test.ts"] },
});
