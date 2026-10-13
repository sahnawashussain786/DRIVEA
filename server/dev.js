/**
 * Local development server.
 * Uses MONGODB_URI if provided; otherwise spins up an in-memory MongoDB
 * so you can develop and test without any external database.
 */
import { createApp } from "./app.js";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { config } from "dotenv";

// Load .env at the project root so MONGODB_URI, CLERK_SECRET_KEY, etc. are
// available before any route/middleware references them.
config({ path: ".env" });

const PORT = process.env.PORT || 4000;

async function start() {
  if (!process.env.MONGODB_URI) {
    console.log("[dev] No MONGODB_URI — starting in-memory MongoDB...");
    const mem = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mem.getUri(); // routes read this via connectDB()
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[dev] In-memory MongoDB ready");
  }

  const app = createApp();
  app.listen(PORT, () =>
    console.log(`[dev] API listening on http://localhost:${PORT}`),
  );
}

start().catch((err) => {
  console.error("[dev] Failed to start:", err);
  process.exit(1);
});
