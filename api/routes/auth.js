import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { connectDB } from '../config/db.js';
import { fileUrl } from '../services/storage.js';

const router = Router();

const publicUser = (u, fileUrlFn = null) => {
  const json = u.toJSON();
  delete json.blob_urls; // not needed here
  return json;
};

router.post('/register', async (req, res) => {
  await connectDB();
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const user = await User.create({
    name: name?.trim() || email.split('@')[0],
    email: String(email).toLowerCase(),
    passwordHash: await bcrypt.hash(String(password), 10),
  });
  res.status(201).json({ user: user.toJSON(), token: signToken(user) });
});

router.post('/login', async (req, res) => {
  await connectDB();
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ user: user.toJSON(), token: signToken(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  await connectDB();
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: user.toJSON() });
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
