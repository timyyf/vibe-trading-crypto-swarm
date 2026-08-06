import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import apiApp from "./src/server/apiApp.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount API Router
  app.use(apiApp);

  // --- VITE MIDDLEWARE / PRODUCTION FALLBACK ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Vibe-Trading Swarm AI running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
