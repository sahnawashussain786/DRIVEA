import { Router } from 'express';
import crypto from 'crypto';
import ShareLink from '../models/ShareLink.js';
import File from '../models/File.js';
import Folder from '../models/Folder.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { connectDB } from '../config/db.js';
import { fileUrl } from '../services/storage.js';

const router = Router();

const makeToken = () => crypto.randomBytes(9).toString('base64url');

function ensureNotExpired(share) {
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) return true;
  return false;
}

// Create or return existing share link (requires auth)
router.post('/', requireAuth, async (req, res) => {
  await connectDB();
  const resourceType = req.body?.resource_type || 'file';
  const resourceId = req.body?.resource_id;
  if (!resourceId) return res.status(400).json({ error: 'resource_id is required' });

  const existing = await ShareLink.findOne({
    ownerId: req.userId,
    resourceType,
    resourceId,
  });
  if (existing && !ensureNotExpired(existing)) {
    const enriched = await hydrateShares([existing], req.userId);
    return res.json({ share: enriched[0], share_link: enriched[0], is_existing: true });
  }

  const share = await ShareLink.create({
    token: makeToken(),
    resourceType,
    resourceId,
    ownerId: req.userId,
    permission: req.body?.permission || 'download',
    expiresAt: req.body?.expires_at || null,
  });
  const enriched = await hydrateShares([share], req.userId);
  res.status(201).json({ share: enriched[0], share_link: enriched[0], is_existing: false });
});

// List my active share links (requires auth)
router.get('/', requireAuth, async (req, res) => {
  await connectDB();
  const shares = await ShareLink.find({ ownerId: req.userId }).sort({ createdAt: -1 });
  const live = shares.filter((s) => !ensureNotExpired(s));
  res.json({ share_links: await hydrateShares(live, req.userId), shares: await hydrateShares(live, req.userId) });
});

// Revoke a share link (requires auth)
router.delete('/:id', requireAuth, async (req, res) => {
  await connectDB();
  const result = await ShareLink.deleteOne({ _id: req.params.id, ownerId: req.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Share link not found' });
  res.json({ message: 'Share link revoked' });
});

// PUBLIC: access a shared resource by token (no auth)
router.get('/access/:token', async (req, res) => {
  await connectDB();
  const share = await ShareLink.findOne({ token: req.params.token });
  if (!share || ensureNotExpired(share)) {
    return res.status(404).json({ error: 'Shared link not found or expired' });
  }

  share.accessCount += 1;
  await share.save();

  const owner = await User.findById(share.ownerId);

  if (share.resourceType === 'file') {
    const file = await File.findById(share.resourceId);
    if (!file || file.isTrashed) return res.status(404).json({ error: 'Shared file is no longer available' });
    return res.json({
      share: share.toJSON(),
      file,
      resource_type: 'file',
      permission: share.permission,
      preview_url: fileUrl(file),
      url: fileUrl(file),
      owner: owner ? { name: owner.name, email: owner.email } : null,
    });
  }

  // folder share
  const folder = await Folder.findById(share.resourceId);
  if (!folder || folder.isTrashed) return res.status(404).json({ error: 'Shared folder is no longer available' });
  const files = await File.find({ folderId: folder._id, isTrashed: false }).sort({ name: 1 });
  res.json({
    share: share.toJSON(),
    folder,
    files: files.map((f) => ({ ...f.toJSON(), url: fileUrl(f) })),
    resource_type: 'folder',
    permission: share.permission,
    owner: owner ? { name: owner.name, email: owner.email } : null,
  });
});

async function hydrateShares(shares, ownerId) {
  const out = [];
  for (const s of shares) {
    const json = s.toJSON();
    if (json.resource_type === 'file') {
      const f = await File.findOne({ _id: json.resource_id, ownerId, isTrashed: false });
      json.resource = f
        ? { id: f._id.toString(), name: f.name, mime_type: f.mimeType, size: f.size }
        : { id: json.resource_id, name: 'Deleted file', mime_type: null, size: 0 };
    } else {
      const fo = await Folder.findOne({ _id: json.resource_id, ownerId, isTrashed: false });
      json.resource = fo
        ? { id: fo._id.toString(), name: fo.name, mime_type: null, size: 0 }
        : { id: json.resource_id, name: 'Deleted folder', mime_type: null, size: 0 };
    }
    out.push(json);
  }
  return out;
}

export default router;
