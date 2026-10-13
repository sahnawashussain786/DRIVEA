import fs from 'fs';
import path from 'path';
import { put, del as blobDel } from '@vercel/blob';

const DEV_UPLOAD_DIR = path.join(process.cwd(), '.uploads');

export const hasBlobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const BLOB_PREFIX = 'drivea';

function ensureDevDir() {
  if (!fs.existsSync(DEV_UPLOAD_DIR)) fs.mkdirSync(DEV_UPLOAD_DIR, { recursive: true });
}

export function s3KeyFor(ownerId, fileName) {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-80);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `users/${ownerId}/${unique}-${safe}`;
}

/** Store an uploaded buffer; returns { key, url, localPath } */
export async function storeFile(ownerId, fileName, buffer, mimeType) {
  const key = s3KeyFor(ownerId, fileName);
  if (hasBlobStorage()) {
    const { url } = await put(`${BLOB_PREFIX}/${key}`, buffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return { key, url, localPath: null };
  }
  ensureDevDir();
  const localPath = path.join(DEV_UPLOAD_DIR, `${key.replace(/[\\/]/g, '__')}`);
  fs.writeFileSync(localPath, buffer);
  return { key, url: null, localPath };
}

/**
 * Create a browser-direct upload context for large files (production only).
 * Returns null when blob storage is unavailable (dev should use multipart upload).
 */
export async function createUploadUrl(ownerId, fileName, contentType) {
  if (!hasBlobStorage()) return null;
  const key = s3KeyFor(ownerId, fileName);
  const buffer = Buffer.alloc(0); // we only need pathname/header hints; size unknown -> let client send
  const { url } = await put(`${BLOB_PREFIX}/${key}`, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    multipart: true,
  });
  return { key, uploadUrl: url };
}

/** Fetch the raw file content as a Buffer/Stream for download routes (dev fallback). */
export function readLocalFile(localPath) {
  return fs.readFileSync(localPath);
}

/** Access/download URL for a stored file (public blob URL in prod, API route in dev). */
export function fileUrl(fileDoc) {
  if (fileDoc.blobUrl) return fileDoc.blobUrl;
  return `/api/files/${fileDoc._id.toString()}/download`;
}

export async function deleteStored(fileDoc) {
  try {
    if (fileDoc.blobUrl) {
      await blobDel(fileDoc.blobUrl);
    } else if (fileDoc.localPath && fs.existsSync(fileDoc.localPath)) {
      fs.unlinkSync(fileDoc.localPath);
    }
  } catch (err) {
    console.error('Failed to delete stored object:', err.message);
  }
}
