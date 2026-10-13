import mongoose from 'mongoose';

/**
 * Shared toJSON transform so every model returns camelCase-in-DB fields as
 * snake_case keys with a plain string `id`, matching the frontend contract.
 */
export const toJSON = (kind) => (doc, ret) => {
  ret.id = doc._id.toString();
  ret.owner_id = doc.ownerId ? doc.ownerId.toString() : null;
  ret.created_at = doc.createdAt ? new Date(doc.createdAt).toISOString() : null;
  ret.updated_at = doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null;

  if (kind === 'user') {
    ret.storage_used = doc.storageUsed;
    ret.storage_limit = doc.storageLimit;
    ret.clerk_id = doc.clerkId || null;
    delete ret.passwordHash;
  }

  if (kind === 'folder') {
    ret.name = doc.name;
    ret.parent_id = doc.parentId ? doc.parentId.toString() : null;
    ret.path = (doc.path || []).map((p) => p.toString());
    ret.is_trashed = doc.isTrashed;
    ret.trashed_at = doc.trashedAt ? new Date(doc.trashedAt).toISOString() : null;
  }

  if (kind === 'file') {
    ret.name = doc.name;
    ret.original_name = doc.originalName;
    ret.mime_type = doc.mimeType;
    ret.size = doc.size;
    ret.s3_key = doc.s3Key;
    ret.blob_url = doc.blobUrl;
    ret.folder_id = doc.folderId ? doc.folderId.toString() : null;
    ret.is_trashed = doc.isTrashed;
    ret.trashed_at = doc.trashedAt ? new Date(doc.trashedAt).toISOString() : null;
    delete ret.localPath; // dev-only, never expose
  }

  if (kind === 'share') {
    ret.token = doc.token;
    ret.resource_type = doc.resourceType;
    ret.resource_id = doc.resourceId ? doc.resourceId.toString() : null;
    ret.permission = doc.permission;
    ret.expires_at = doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null;
    ret.access_count = doc.accessCount;
  }

  // hide internal mongo keys
  delete ret._id;
  delete ret.__v;
  for (const key of Object.keys(ret)) {
    if (ret[key] instanceof mongoose.Types.ObjectId) ret[key] = ret[key].toString();
  }
  return ret;
};
