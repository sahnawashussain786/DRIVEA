import "dotenv/config";
import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
const CLERK_ACTIVE = Boolean(CLERK_SECRET_KEY);
const LEGACY_SECRET = process.env.JWT_SECRET || "drivea_dev_secret_change_me";

// ---------------------------------------------------------------------------
// Clerk middleware — mounted app-wide when Clerk is configured.
// When CLERK_SECRET_KEY is absent (local dev without Clerk), we deliberately
// skip it so the legacy JWT path still works during migration.
//
// NOTE: @clerk/express v2.1.x requires CLERK_PUBLISHABLE_KEY even for the
// server-side middleware factory. If only CLERK_SECRET_KEY is set, the factory
// logs "Publishable key is missing" and throws. We guard against that so the
// API stays up; route-level auth will 401 until a publishable key is configured.
// ---------------------------------------------------------------------------

export function mountClerkMiddleware(app) {
  if (!CLERK_ACTIVE) return;
  // @clerk/express v2.x requires CLERK_PUBLISHABLE_KEY to be set, even for
  // the server-side middleware factory. With only CLERK_SECRET_KEY present the
  // factory throws ("Publishable key is missing"). We catch that so the API
  // still boots; auth routes will 401 until a publishable key is configured.
  try {
    app.use(clerkMiddleware());
  } catch (err) {
    console.error("[clerk] clerkMiddleware() unavailable:", err.message);
    app.use((req, res, next) => next());
  }
}

// ---------------------------------------------------------------------------
// Thin compatibility layer: every route reads the user id from here.
// Preference: Clerk (req.auth). Fallback: legacy JWT (req.userId).
// ---------------------------------------------------------------------------

export function requireAuth(req, res, next) {
  if (CLERK_ACTIVE) {
    try {
      const hdr = req.headers.authorization || "";
      if (hdr.startsWith("Bearer ")) {
        const parts = hdr.slice(7).split(".");
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
            console.log(
              "[auth-debug] bearer iss=%s sub=%s iat=%s nbf=%s exp=%s",
              payload.iss,
              payload.sub,
              payload.iat != null ? new Date(payload.iat * 1000).toISOString() : "-",
              payload.nbf != null ? new Date(payload.nbf * 1000).toISOString() : "-",
              payload.exp != null ? new Date(payload.exp * 1000).toISOString() : "-",
            );
          } catch (e) {
            console.log("[auth-debug] bearer payload unparsable");
          }
        }
      } else {
        console.log("[auth-debug] no bearer header");
      }
    } catch {}
    const { isAuthenticated, userId } = getAuth(req);
    if (!isAuthenticated || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.userId = userId;
    return next();
  }

  // Legacy JWT path (dev without Clerk keys)
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, LEGACY_SECRET);
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
// Ensure a local User document exists for a Clerk user (lazy provisioning).
// Stores name/email/storage accounting locally so the drive can track quota.
// In legacy (non-Clerk) mode this just returns the existing document by _id.
// ---------------------------------------------------------------------------
export async function ensureUser(userId, clerkUser) {
  if (!CLERK_ACTIVE) {
    // Legacy JWT path: userId is the mongo _id.
    return userId ? await User.findById(userId) : null;
  }

  const existing = await User.findOne({ clerkId: userId });
  if (existing) {
    // Keep email/name roughly in sync with Clerk (cheap, best-effort)
    if (clerkUser) {
      const wants = {
        name: clerkUser.username || clerkUser.firstName || "User",
        email:
          clerkUser.emailAddresses?.[0]?.emailAddress || existing.email || "",
      };
      if (wants.name && wants.name !== existing.name)
        existing.name = wants.name;
      if (wants.email && wants.email !== existing.email)
        existing.email = wants.email;
      await existing.save();
    }
    return existing;
  }

  // First encounter — provision from Clerk user object
  if (!clerkUser) {
    try {
      clerkUser = await clerkClient.users.getUser(userId);
    } catch (err) {
      console.error("[auth] clerkClient.users.getUser failed:", err.message);
      clerkUser = null;
    }
  }

  const name =
    clerkUser?.username ||
    clerkUser?.firstName ||
    (clerkUser?.emailAddresses?.[0]?.emailAddress || "").split("@")[0] ||
    "User";
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@local.dev`;

  const user = await User.create({
    clerkId: userId,
    name: name.trim() || "User",
    email,
    passwordHash: null,
    storageUsed: 0,
    storageLimit: Number(process.env.STORAGE_LIMIT_BYTES) || 1073741824, // 1 GB default
  });
  return user;
}

export { CLERK_ACTIVE };

// ---------------------------------------------------------------------------
// Storage accounting helpers — work for both Clerk (clerkId) and legacy (_id).
// ---------------------------------------------------------------------------
export function userFilterFor(userId) {
  return CLERK_ACTIVE ? { clerkId: userId } : { _id: userId };
}

export async function updateUserStorage(userId, delta) {
  if (!CLERK_ACTIVE && !userId) return;
  // In legacy mode userId is the mongo _id; in Clerk mode it's the clerkId.
  const filter = userFilterFor(userId);
  await User.updateOne(filter, { $inc: { storageUsed: delta } });
}
