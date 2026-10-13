import { Router } from 'express';
import { requireAuth, ensureUser, CLERK_ACTIVE } from '../middleware/auth.js';
import { connectDB } from '../config/db.js';

const router = Router();

// POST /auth/register — removed: Clerk handles sign-up.
// POST /auth/login  — removed: Clerk handles sign-in.
// The client now authenticates via Clerk and sends the Clerk session token as
// Authorization: Bearer <token>. The jwt secret is no longer used for login.

// GET /auth/me — return the current user's local profile + storage accounting.
// Lazily provisions a local User document for the Clerk user on first call.
router.get('/me', requireAuth, async (req, res) => {
  await connectDB();
  const user = await ensureUser(req.userId);
  if (!user) {
    // Should not happen once Clerk is configured; fallback for legacy token.
    const fallback = await require('mongoose').default.models.User?.findById(req.userId);
    if (!fallback) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user: fallback.toJSON() });
  }
  res.json({ user: user.toJSON() });
});

// POST /auth/logout — no-op server side. Clerk sessions are stateless JWTs;
// sign-out is handled client-side by Clerk (clears the session token).
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
