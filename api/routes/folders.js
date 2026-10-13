import { Router } from 'express';
import Folder from '../models/Folder.js';
import File from '../models/File.js';
import { requireAuth } from '../middleware/auth.js';
import { connectDB } from '../config/db.js';

const router = Router();
router.use(requireAuth);

// Build ancestor breadcrumb for a folder (own root chain only)
async function breadcrumbsFor(folder) {
  const crumbs = [];
  let curr = folder;
  while (curr && curr.parentId) {
    const parent = await Folder.findOne({ _id: curr.parentId, ownerId: folder.ownerId });
    if (!parent) break;
    crumbs.unshift({ id: parent._id.toString(), name: parent.name });
    curr = parent;
  }
  return crumbs;
}

// List folders (optionally under a parent) — excludes trashed
router.get('/', async (req, res) => {
  await connectDB();
  const query = { ownerId: req.userId, isTrashed: false };
  if ('parent_id' in req.query) {
    const raw = req.query.parent_id;
    query.parentId = raw === 'null' || !raw ? null : raw;
  }
  const folders = await Folder.find(query).sort({ name: 1 });
  res.json({ folders });
});

// Create folder
router.post('/', async (req, res) => {
  await connectDB();
  const parentId = req.body?.parent_id || null;
  let path = [];
  if (parentId) {
    const parent = await Folder.findOne({ _id: parentId, ownerId: req.userId });
    if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
    path = [...(parent.path || []), parent._id];
  }
  const folder = await Folder.create({
    name: req.body?.name?.trim() || 'Untitled Folder',
    parentId,
    ownerId: req.userId,
    path,
  });
  res.status(201).json({ folder });
});

router.get('/:id', async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  res.json({ folder, breadcrumbs: await breadcrumbsFor(folder) });
});

// Rename folder
router.patch('/:id/rename', async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  if (req.body?.name?.trim()) folder.name = req.body.name.trim();
  await folder.save();
  res.json({ folder });
});

// Move folder under a new parent (guards against cycles)
router.patch('/:id/move', async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  const raw = req.body?.target_parent ?? req.body?.target_parent_id;
  const targetParentId = raw === 'null' || !raw ? null : raw;

  if (targetParentId) {
    if (String(targetParentId) === String(folder._id)) {
      return res.status(400).json({ error: 'Cannot move a folder into itself' });
    }
    const target = await Folder.findOne({ _id: targetParentId, ownerId: req.userId });
    if (!target) return res.status(404).json({ error: 'Target folder not found' });
    if ((target.path || []).some((p) => p.toString() === String(folder._id))) {
      return res.status(400).json({ error: 'Cannot move a folder into one of its subfolders' });
    }
    folder.parentId = target._id;
    folder.path = [...(target.path || []), target._id];
  } else {
    folder.parentId = null;
    folder.path = [];
  }
  await folder.save();

  // Update descendants' paths (replace the stale prefix path with the new one)
  const descendants = await Folder.find({ ownerId: req.userId, path: folder._id });
  for (const child of descendants) {
    child.path = [...(folder.path || []), folder._id, ...child.path.slice(child.path.indexOf(folder._id) + 1)];
    await child.save();
  }
  res.json({ folder });
});

// Trash folder (soft delete)
router.delete('/:id', async (req, res) => {
  await connectDB();
  const folder = await Folder.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.userId },
    { isTrashed: true, trashedAt: new Date() },
    { new: true }
  );
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  // Soft delete descendants + their files
  await Folder.updateMany({ ownerId: req.userId, path: folder._id }, { isTrashed: true, trashedAt: new Date() });
  const trashedFolderIds = [folder._id, ...(await Folder.find({ ownerId: req.userId, path: folder._id }).select('_id'))].map((f) => f._id);
  await File.updateMany(
    { ownerId: req.userId, folderId: { $in: trashedFolderIds } },
    { isTrashed: true, trashedAt: new Date() }
  );
  res.json({ message: 'Folder moved to trash' });
});

// Restore folder from trash
router.post('/:id/restore', async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  folder.isTrashed = false;
  folder.trashedAt = null;

  // If parent currently trashed/nonexistent, restore to root
  if (folder.parentId) {
    const parent = await Folder.findOne({ _id: folder.parentId, ownerId: req.userId });
    if (!parent || parent.isTrashed) {
      folder.parentId = null;
      folder.path = [];
    }
  }
  await folder.save();
  await Folder.updateMany({ ownerId: req.userId, path: folder._id }, { isTrashed: false, trashedAt: null });
  const folderIds = [folder._id, ...(await Folder.find({ ownerId: req.userId, path: folder._id }).select('_id'))].map((f) => f._id);
  await File.updateMany({ ownerId: req.userId, folderId: { $in: folderIds } }, { isTrashed: false, trashedAt: null });
  res.json({ folder });
});

// Permanently delete folder (and contents)
router.delete('/:id/permanent', async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!folder) return res.status(404).json({ error: 'Folder not found' });
  const descendants = await Folder.find({ ownerId: req.userId, path: folder._id }).select('_id');
  const folderIds = [folder._id, ...descendants.map((d) => d._id)];
  await File.deleteMany({ ownerId: req.userId, folderId: { $in: folderIds } });
  await Folder.deleteMany({ _id: { $in: folderIds }, ownerId: req.userId });
  res.json({ message: 'Folder permanently deleted' });
});

export default router;
