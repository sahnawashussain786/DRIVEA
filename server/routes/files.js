import { Router } from 'express';
import multer from 'multer';
import File from '../models/File.js';
import Folder from '../models/Folder.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { connectDB } from '../config/db.js';
import {
  storeFile,
  hasBlobStorage,
  readLocalFile,
  fileUrl,
  deleteStored,
} from '../services/storage.js';

const router = Router();
const MAX_PER_FILE = 4.5 * 1024 * 1024 * 1024; // generous; Vercel caps request body anyway

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PER_FILE },
});

router.use(requireAuth);

// List files (optionally in folder, search, sort) — excludes trashed
router.get('/', async (req, res) => {
  await connectDB();
  const query = { ownerId: req.userId, isTrashed: false };
  if ('folder_id' in req.query) {
    const raw = req.query.folder_id;
    query.folderId = raw === 'null' || !raw ? null : raw;
  }
  let filter = query;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter = { ...query, name: rx };
  }

  const sortMap = {
    name_asc: { name: 1 },
    name_desc: { name: -1 },
    date_asc: { createdAt: 1 },
    date_desc: { createdAt: -1 },
    size_asc: { size: 1 },
    size_desc: { size: -1 },
  };
  const sort = sortMap[req.query.sort] || { name: 1 };

  const files = await File.find(filter).sort(sort);
  res.json({ files });
});

// Register an already-uploaded object (browser-direct upload to Vercel Blob)
router.post('/register', async (req, res) => {
  await connectDB();
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { name, mime_type, size, s3_key, blob_url, folder_id } = req.body || {};
  if (!name || !s3_key || !blob_url) {
    return res.status(400).json({ error: 'name, s3_key and blob_url are required' });
  }

  const fileSize = Number(size) || 0;
  if (user.storageUsed + fileSize > user.storageLimit) {
    return res.status(413).json({ error: 'Storage limit exceeded' });
  }

  let folderId = folder_id && folder_id !== 'null' ? folder_id : null;
  if (folderId) {
    const folder = await Folder.findOne({ _id: folderId, ownerId: req.userId });
    if (!folder) folderId = null;
  }

  const file = await File.create({
    name,
    originalName: name,
    mimeType: mime_type || 'application/octet-stream',
    size: fileSize,
    s3Key: s3_key,
    blobUrl: blob_url,
    folderId,
    ownerId: req.userId,
  });
  user.storageUsed += fileSize;
  await user.save();

  res.status(201).json({ file, files: [file] });
});

// Multipart upload (primary path in dev, small files anywhere)
router.post('/upload', upload.array('files', 20), async (req, res) => {
  await connectDB();
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const incoming = req.files || [];
  if (incoming.length === 0) return res.status(400).json({ error: 'No files provided' });

  const rawFolder = req.body?.folder_id;
  let folderId = rawFolder && rawFolder !== 'null' ? rawFolder : null;
  if (folderId) {
    const folder = await Folder.findOne({ _id: folderId, ownerId: req.userId });
    if (!folder) folderId = null;
  }

  const totalSize = incoming.reduce((acc, f) => acc + f.size, 0);
  if (user.storageUsed + totalSize > user.storageLimit) {
    return res.status(413).json({ error: 'Storage limit exceeded' });
  }

  const stored = [];
  for (const f of incoming) {
    const meta = await storeFile(req.userId, f.originalname, f.buffer, f.mimetype);
    stored.push({
      ownerId: req.userId,
      name: f.originalname,
      originalName: f.originalname,
      mimeType: f.mimetype || 'application/octet-stream',
      size: f.size,
      s3Key: meta.key,
      blobUrl: meta.url,
      localPath: meta.localPath,
      folderId,
    });
  }

  const files = await File.insertMany(stored);
  user.storageUsed += totalSize;
  await user.save();

  const clean = files.filter((f) => f !== undefined);
  res.status(201).json({ files: clean, file: clean[0] });
});

// Download route (dev fallback for locally-stored files)
router.get('/:id/download', async (req, res) => {
  await connectDB();
  const file = await File.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!file.localPath) {
    if (file.blobUrl) return res.redirect(file.blobUrl);
    return res.status(404).json({ error: 'File content unavailable' });
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(file.originalName)}"`
  );
  res.send(readLocalFile(file.localPath));
});

// Preview URL
router.get('/:id/preview', async (req, res) => {
  await connectDB();
  const file = await File.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!file) return res.status(404).json({ error: 'File not found' });
  const url = fileUrl(file);
  res.json({ preview_url: url, url, file });
});

// Rename
router.patch('/:id/rename', async (req, res) => {
  await connectDB();
  const file = await File.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (req.body?.name?.trim()) file.name = req.body.name.trim();
  await file.save();
  res.json({ file });
});

// Move to another folder
router.patch('/:id/move', async (req, res) => {
  await connectDB();
  const file = await File.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!file) return res.status(404).json({ error: 'File not found' });

  const raw = req.body?.target_folder ?? req.body?.target_folder_id;
  const targetFolderId = raw === 'null' || !raw ? null : raw;
  if (targetFolderId) {
    const folder = await Folder.findOne({ _id: targetFolderId, ownerId: req.userId });
    if (!folder) return res.status(404).json({ error: 'Target folder not found' });
    file.folderId = folder._id;
  } else {
    file.folderId = null;
  }
  await file.save();
  res.json({ file });
});

// Trash (soft delete)
router.delete('/:id', async (req, res) => {
  await connectDB();
  const file = await File.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.userId },
    { isTrashed: true, trashedAt: new Date() },
    { new: true }
  );
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json({ message: 'File moved to trash' });
});

// Restore
router.post('/:id/restore', async (req, res) => {
  await connectDB();
  const file = await File.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!file) return res.status(404).json({ error: 'File not found' });

  file.isTrashed = false;
  file.trashedAt = null;
  // If its folder is still trashed/nonexistent, surface the file at root
  if (file.folderId) {
    const folder = await Folder.findOne({ _id: file.folderId, ownerId: req.userId });
    if (!folder || folder.isTrashed) file.folderId = null;
  }
  await file.save();
  res.json({ file });
});

// Permanently delete
router.delete('/:id/permanent', async (req, res) => {
  await connectDB();
  const file = await File.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!file) return res.status(404).json({ error: 'File not found' });

  await deleteStored(file);
  await User.updateOne(
    { _id: req.userId },
    { $inc: { storageUsed: -Number(file.size || 0) } }
  );
  await file.deleteOne();
  res.json({ message: 'File permanently deleted' });
});

export default router;
