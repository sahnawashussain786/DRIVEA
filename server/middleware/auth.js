import "dotenv/config";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "drivea_dev_secret_change_me";

// ---------------------------------------------------------------------------
// JWT auth
// Tokens are issued by /auth/register and /auth/login as
//   { sub: <user _id>, email } with a 30 day expiry.
// Every protected route reads the user id from requireAuth (req.userId).
// ---------------------------------------------------------------------------

export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" },
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function getUserId(req) {
  return req.userId;
}

// ---------------------------------------------------------------------------
// Load the local User document for the authenticated user.
// ---------------------------------------------------------------------------
export async function ensureUser(userId) {
  return userId ? User.findById(userId) : null;
}

// ---------------------------------------------------------------------------
// Storage accounting helpers
// ---------------------------------------------------------------------------
export function userFilterFor(userId) {
  return { _id: userId };
}

export async function updateUserStorage(userId, delta) {
  if (!userId) return;
  const filter = userFilterFor(userId);
  await User.updateOne(filter, { $inc: { storageUsed: delta } });
}
