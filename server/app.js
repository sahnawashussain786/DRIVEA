import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import folderRoutes from "./routes/folders.js";
import fileRoutes from "./routes/files.js";
import trashRoutes from "./routes/trash.js";
import shareRoutes from "./routes/shares.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) =>
    res.json({ ok: true, service: "drivea-api" }),
  )

  app.use("/api/auth", authRoutes);
  app.use("/api/folders", folderRoutes);
  app.use("/api/files", fileRoutes);
  app.use("/api/trash", trashRoutes);
  app.use("/api/shares", shareRoutes);

  // 404 for unknown API routes
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API route not found" }),
  );

  // Central error handler — always JSON, never leak stack traces
  app.use((err, req, res, next) => {
    console.error("[api]", err.message);
    const status = err.status || err.statusCode || 500;
    res
      .status(status)
      .json({ error: status === 500 ? "Internal server error" : err.message });
  });

  return app;
}
