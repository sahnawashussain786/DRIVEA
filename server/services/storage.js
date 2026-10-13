import fs from "fs";
import path from "path";
import { put, del as blobDel, get as blobGet } from "@vercel/blob";
import { pipeline } from "stream/promises";

const DEV_UPLOAD_DIR = path.join(process.cwd(), ".uploads");

export const hasBlobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const BLOB_PREFIX = "drivea";

function ensureDevDir() {
  if (!fs.existsSync(DEV_UPLOAD_DIR))
    fs.mkdirSync(DEV_UPLOAD_DIR, { recursive: true });
}

export function s3KeyFor(ownerId, fileName) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `users/${ownerId}/${unique}-${safe}`;
}

/** Store an uploaded buffer; returns { key, url, localPath } */
export async function storeFile(ownerId, fileName, buffer, mimeType) {
  const key = s3KeyFor(ownerId, fileName);
  if (hasBlobStorage()) {
    const { url } = await put(`${BLOB_PREFIX}/${key}`, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return { key, url, localPath: null };
  }
  ensureDevDir();
  const localPath = path.join(DEV_UPLOAD_DIR, `${key.replace(/[\\/]/g, "__")}`);
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
    access: "public",
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
    console.error("Failed to delete stored object:", err.message);
  }
}

/**
 * Duplicate a stored file's content under a new key/url/localPath.
 * Returns { key, url, localPath } for the new copy. The caller is responsible
 * for creating the new File document and charging storage.
 *
 * - Blob storage (prod): downloads the source blob and re-uploads it under a new
 *   key so the copy is fully independent of the original.
 * - Local dev: copies the local file to a new path.
 *
 * Intentionally synchronous-ish on the local path (dev only, small files).
 */
export async function duplicateStoredFile(fileDoc, destOwnerId, destName) {
  const destKey = s3KeyFor(destOwnerId, destName);

  if (fileDoc.blobUrl) {
    // Download source blob, re-upload under a new key.
    const src = fileDoc.blobUrl.startsWith("http")
      ? fileDoc.blobUrl
      : `https://${process.env.VERCEL_BLOB_DOMAIN || "drivea"}.blob.vercel-storage.com/${fileDoc.blobUrl}`;
    const srcBuffer = await blobGet(src).arrayBuffer();
    const { url } = await put(
      `${BLOB_PREFIX}/${destKey}`,
      Buffer.from(srcBuffer),
      {
        access: "public",
        contentType: fileDoc.mimeType,
        addRandomSuffix: false,
      },
    );
    return { key: destKey, url, localPath: null };
  }

  // Local dev: copy the file on disk to a new path.
  if (!fileDoc.localPath || !fs.existsSync(fileDoc.localPath)) {
    throw new Error("Source file content not available for copy");
  }
  ensureDevDir();
  const destLocalPath = path.join(
    DEV_UPLOAD_DIR,
    destKey.replace(/[\\/]/g, "__"),
  );
  fs.mkdirSync(path.dirname(destLocalPath), { recursive: true });
  fs.copyFileSync(fileDoc.localPath, destLocalPath);
  return { key: destKey, url: null, localPath: destLocalPath };
}

/** Read a stored file's content as a Buffer (blob download or local disk). */
export async function readStoredAsBuffer(fileDoc) {
  if (fileDoc.blobUrl) {
    const src = fileDoc.blobUrl.startsWith("http")
      ? fileDoc.blobUrl
      : `https://${process.env.VERCEL_BLOB_DOMAIN || "drivea"}.blob.vercel-storage.com/${fileDoc.blobUrl}`;
    const buf = await blobGet(src).arrayBuffer();
    return Buffer.from(buf);
  }
  if (fileDoc.localPath && fs.existsSync(fileDoc.localPath)) {
    return fs.readFileSync(fileDoc.localPath);
  }
  throw new Error("File content not available");
}

/** Return a readable stream for a stored file's content (blob or local disk). */
export function fileContentStream(fileDoc) {
  if (fileDoc.blobUrl) {
    const src = fileDoc.blobUrl.startsWith("http")
      ? fileDoc.blobUrl
      : `https://${process.env.VERCEL_BLOB_DOMAIN || "drivea"}.blob.vercel-storage.com/${fileDoc.blobUrl}`;
    return blobGet(src).stream();
  }
  if (fileDoc.localPath && fs.existsSync(fileDoc.localPath)) {
    return fs.createReadStream(fileDoc.localPath);
  }
  throw new Error("File content not available");
}
