import { Router } from 'express';
import File from '../models/File.js';
import Folder from '../models/Folder.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { connectDB } from '../config/db.js';
import { deleteStored } from '../services/storage.js';

const router = Router();
router.use(requireAuth);

// List trashed items
router.get('/', async (req, res) => {
  await connectDB();
  const [files, folders] = await Promise.all([
    File.find({ ownerId: req.userId, isTrashed: true }).sort({ trashedAt: -1 }),
    Folder.find({ ownerId: req.userId, isTrashed: true }).sort({ trashedAt: -1 }),
  ]);
  res.json({ files, folders });
});

// Empty trash (all)
router.post('/empty', async (req, res) => {
  await connectDB();
  const [files, folders] = await Promise.all([
    File.find({ ownerId: req.userId, isTrashed: true }),
    Folder.find({ ownerId: req.userId, isTrashed: true }),
  ]);

  let freed = 0;
  for (const f of files) {
    await deleteStored(f);
    freed += Number(f.size || 0);
  }
  if (files.length) await File.deleteMany({ ownerId: req.userId, isTrashed: true });
  if (folders.length) await Folder.deleteMany({ ownerId: req.userId, isTrashed: true });

  if (freed > 0) {
    await User.updateOne({ _id: req.userId }, { $inc: { storageUsed: -freed } });
  }
  res.json({ message: 'Trash emptied successfully' });
});

export default router;
