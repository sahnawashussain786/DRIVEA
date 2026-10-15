import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, ensureUser, signToken } from "../middleware/auth.js";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /auth/register — {name?, email, password}
// Creates a local user account and returns the profile + JWT.
// ---------------------------------------------------------------------------
router.post("/register", async (req, res) => {
  await connectDB();
  const { name, email, password } = req.body || {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: (name && String(name).trim()) || normalizedEmail.split("@")[0],
    email: normalizedEmail,
    passwordHash,
    storageUsed: 0,
    storageLimit: Number(process.env.STORAGE_LIMIT_BYTES) || 1073741824, // 1 GB
  });

  res.status(201).json({ user: user.toJSON(), token: signToken(user) });
});

// ---------------------------------------------------------------------------
// POST /auth/login — {email, password} → verify + issue JWT.
// ---------------------------------------------------------------------------
router.post("/login", async (req, res) => {
  await connectDB();
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await User.findOne({
    email: String(email).trim().toLowerCase(),
  });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({ user: user.toJSON(), token: signToken(user) });
});

// GET /auth/me — current user's profile + storage accounting.
router.get("/me", requireAuth, async (req, res) => {
  await connectDB();
  const user = await ensureUser(req.userId);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: user.toJSON() });
});

// POST /auth/logout — stateless JWT; client drops the token.
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

export default router;
