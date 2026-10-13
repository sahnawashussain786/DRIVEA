import { Router } from "express";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import User from "../models/User.js";
import {
  requireAuth,
  ensureUser,
  updateUserStorage,
} from "../middleware/auth.js";
import { connectDB } from "../config/db.js";
import {
  duplicateStoredFile,
  readStoredAsBuffer,
  storeFile,
} from "../services/storage.js";

const router = Router();
router.use(requireAuth);

// Build ancestor breadcrumb for a folder (own root chain only)
async function breadcrumbsFor(folder) {
  const crumbs = [];
  let curr = folder;
  while (curr && curr.parentId) {
    const parent = await Folder.findOne({
      _id: curr.parentId,
      ownerId: folder.ownerId,
    });
    if (!parent) break;
    crumbs.unshift({ id: parent._id.toString(), name: parent.name });
    curr = parent;
  }
  return crumbs;
}

// List folders (optionally under a parent) — excludes trashed
router.get("/", async (req, res) => {
  await connectDB();
  const query = { ownerId: req.userId, isTrashed: false };
  if ("parent_id" in req.query) {
    const raw = req.query.parent_id;
    query.parentId = raw === "null" || !raw ? null : raw;
  }
  const folders = await Folder.find(query).sort({ name: 1 });
  res.json({ folders });
});

// Create folder
router.post("/", async (req, res) => {
  await connectDB();
  const parentId = req.body?.parent_id || null;
  let path = [];
  if (parentId) {
    const parent = await Folder.findOne({ _id: parentId, ownerId: req.userId });
    if (!parent)
      return res.status(404).json({ error: "Parent folder not found" });
    path = [...(parent.path || []), parent._id];
  }
  const folder = await Folder.create({
    name: req.body?.name?.trim() || "Untitled Folder",
    parentId,
    ownerId: req.userId,
    path,
  });
  res.status(201).json({ folder });
});

router.get("/:id", async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({
    _id: req.params.id,
    ownerId: req.userId,
  });
  if (!folder) return res.status(404).json({ error: "Folder not found" });
  res.json({ folder, breadcrumbs: await breadcrumbsFor(folder) });
});

// Rename folder
router.patch("/:id/rename", async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({
    _id: req.params.id,
    ownerId: req.userId,
  });
  if (!folder) return res.status(404).json({ error: "Folder not found" });
  if (req.body?.name?.trim()) folder.name = req.body.name.trim();
  await folder.save();
  res.json({ folder });
});

// Move folder under a new parent (guards against cycles)
router.patch("/:id/move", async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({
    _id: req.params.id,
    ownerId: req.userId,
  });
  if (!folder) return res.status(404).json({ error: "Folder not found" });

  const raw = req.body?.target_parent ?? req.body?.target_parent_id;
  const targetParentId = raw === "null" || !raw ? null : raw;

  if (targetParentId) {
    if (String(targetParentId) === String(folder._id)) {
      return res
        .status(400)
        .json({ error: "Cannot move a folder into itself" });
    }
    const target = await Folder.findOne({
      _id: targetParentId,
      ownerId: req.userId,
    });
    if (!target)
      return res.status(404).json({ error: "Target folder not found" });
    if ((target.path || []).some((p) => p.toString() === String(folder._id))) {
      return res
        .status(400)
        .json({ error: "Cannot move a folder into one of its subfolders" });
    }
    folder.parentId = target._id;
    folder.path = [...(target.path || []), target._id];
  } else {
    folder.parentId = null;
    folder.path = [];
  }
  await folder.save();

  // Update descendants' paths (replace the stale prefix path with the new one)
  const descendants = await Folder.find({
    ownerId: req.userId,
    path: folder._id,
  });
  for (const child of descendants) {
    child.path = [
      ...(folder.path || []),
      folder._id,
      ...child.path.slice(child.path.indexOf(folder._id) + 1),
    ];
    await child.save();
  }
  res.json({ folder });
});

// Trash folder (soft delete)
router.delete("/:id", async (req, res) => {
  await connectDB();
  const folder = await Folder.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.userId },
    { isTrashed: true, trashedAt: new Date() },
    { new: true },
  );
  if (!folder) return res.status(404).json({ error: "Folder not found" });

  // Soft delete descendants + their files
  await Folder.updateMany(
    { ownerId: req.userId, path: folder._id },
    { isTrashed: true, trashedAt: new Date() },
  );
  const trashedFolderIds = [
    folder._id,
    ...(await Folder.find({ ownerId: req.userId, path: folder._id }).select(
      "_id",
    )),
  ].map((f) => f._id);
  await File.updateMany(
    { ownerId: req.userId, folderId: { $in: trashedFolderIds } },
    { isTrashed: true, trashedAt: new Date() },
  );
  res.json({ message: "Folder moved to trash" });
});

// Restore folder from trash
router.post("/:id/restore", async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({
    _id: req.params.id,
    ownerId: req.userId,
  });
  if (!folder) return res.status(404).json({ error: "Folder not found" });

  folder.isTrashed = false;
  folder.trashedAt = null;

  // If parent currently trashed/nonexistent, restore to root
  if (folder.parentId) {
    const parent = await Folder.findOne({
      _id: folder.parentId,
      ownerId: req.userId,
    });
    if (!parent || parent.isTrashed) {
      folder.parentId = null;
      folder.path = [];
    }
  }
  await folder.save();
  await Folder.updateMany(
    { ownerId: req.userId, path: folder._id },
    { isTrashed: false, trashedAt: null },
  );
  const folderIds = [
    folder._id,
    ...(await Folder.find({ ownerId: req.userId, path: folder._id }).select(
      "_id",
    )),
  ].map((f) => f._id);
  await File.updateMany(
    { ownerId: req.userId, folderId: { $in: folderIds } },
    { isTrashed: false, trashedAt: null },
  );
  res.json({ folder });
});

// Permanently delete folder (and contents)
router.delete("/:id/permanent", async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({
    _id: req.params.id,
    ownerId: req.userId,
  });
  if (!folder) return res.status(404).json({ error: "Folder not found" });
  const descendants = await Folder.find({
    ownerId: req.userId,
    path: folder._id,
  }).select("_id");
  const folderIds = [folder._id, ...descendants.map((d) => d._id)];
  await File.deleteMany({ ownerId: req.userId, folderId: { $in: folderIds } });
  await Folder.deleteMany({ _id: { $in: folderIds }, ownerId: req.userId });
  res.json({ message: "Folder permanently deleted" });
});

// Copy a folder (real independent copy of structure + file contents)
router.post("/:id/copy", async (req, res) => {
  await connectDB();
  const source = await Folder.findOne({
    _id: req.params.id,
    ownerId: req.userId,
    isTrashed: false,
  });
  if (!source) return res.status(404).json({ error: "Folder not found" });

  const targetParentId =
    req.body?.target_parent_id && req.body.target_parent_id !== "null"
      ? req.body.target_parent_id
      : source.parentId?.toString() || null;
  if (targetParentId) {
    const parent = await Folder.findOne({
      _id: targetParentId,
      ownerId: req.userId,
      isTrashed: false,
    });
    if (!parent)
      return res.status(404).json({ error: "Target folder not found" });
  }

  const wantName = (req.body?.name || "").trim();
  const name = wantName || `Copy of ${source.name}`;

  // Total size of all files in the entire subtree (for quota check + charging)
  const descendantIds = await Folder.find({
    ownerId: req.userId,
    path: source._id,
  }).select("_id");
  const folderIdSet = new Set([source._id, ...descendantIds.map((d) => d._id)]);
  let totalSize = 0;
  const filesCursor = File.find({
    ownerId: req.userId,
    folderId: { $in: [...folderIdSet] },
    isTrashed: false,
  })
    .select("size")
    .cursor();
  for await (const doc of filesCursor) {
    totalSize += Number(doc.size || 0);
  }

  const user = await ensureUser(req.userId);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.storageUsed + totalSize > user.storageLimit) {
    return res.status(413).json({ error: "Storage limit exceeded" });
  }

  // Map old folder id -> newly created folder doc.
  const newFolderByOldId = new Map();

  const copyFolder = async (oldFolder, newParentId, name) => {
    const created = await Folder.create({
      name: name ?? oldFolder.name,
      parentId: newParentId || null,
      ownerId: req.userId,
      path: newParentId
        ? [
            ...(newFolderByOldId.get(newParentId)?.path || []),
            newFolderByOldId.get(newParentId)?._id,
          ]
        : [],
    });
    newFolderByOldId.set(oldFolder._id.toString(), created);

    // Copy immediate child folders first (so their path can reference the new parent)
    const childFolders = await Folder.find({
      ownerId: req.userId,
      parentId: oldFolder._id,
      isTrashed: false,
    });
    for (const child of childFolders) {
      await copyFolder(child, created._id, child.name);
    }

    // Copy files directly in this folder
    const childFiles = await File.find({
      ownerId: req.userId,
      folderId: oldFolder._id,
      isTrashed: false,
    });
    for (const f of childFiles) {
      let meta;
      try {
        meta = await duplicateStoredFile(f, req.userId, f.originalName);
      } catch (err) {
        console.error("[folder-copy] duplicateStoredFile failed:", err.message);
        return res.status(500).json({ error: "Failed to copy file content" });
      }
      await File.create({
        name: f.name,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        s3Key: meta.key,
        blobUrl: meta.url,
        localPath: meta.localPath,
        folderId: created._id,
        ownerId: req.userId,
      });
      await updateUserStorage(req.userId, f.size);
    }
  };

  await copyFolder(source, targetParentId || null, name);  const newRoot = newFolderByOldId.get(source._id.toString());
  res.status(201).json({ folder: newRoot });
});

// Toggle star on a folder
router.patch("/:id/star", async (req, res) => {
  await connectDB();
  const folder = await Folder.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!folder) return res.status(404).json({ error: "Folder not found" });
  folder.isStarred = !!req.body?.is_starred;
  await folder.save();
  res.json({ folder });
});

// Batch permanently delete folders (and their contents)
router.post("/batch/delete", async (req, res) => {
  await connectDB();
  const ids = (req.body?.ids || []).map(String);
  if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });
  const descendants = await Folder.find({
    ownerId: req.userId,
    _id: { $in: ids },
  }).select("_id");
  const folderIds = [...ids, ...descendants.map((d) => d._id)];
  await File.deleteMany({ ownerId: req.userId, folderId: { $in: folderIds } });
  await Folder.deleteMany({ _id: { $in: folderIds }, ownerId: req.userId });
  res.json({ deleted: folderIds.length });
});
export default router;
