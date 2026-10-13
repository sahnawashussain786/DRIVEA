import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'drivea_dev_secret_change_me';

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, SECRET, { expiresIn: '30d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
