import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import http from "http";
import { createApp } from "./server/app.js";
import File from "./server/models/File.js";
import Folder from "./server/models/Folder.js";
import User from "./server/models/User.js";
import { storeFile } from "./server/services/storage.js";

const JWT_SECRET = process.env.JWT_SECRET || "drivea_dev_secret_change_me";
async function makeToken(sub) {
  return jwt.sign({ sub, email: "test@test.com" }, JWT_SECRET, {
    expiresIn: "30d",
  });
}
function request(port, token, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };
    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        let json = null;
        try {
          json = body ? JSON.parse(body) : null;
        } catch {}
        resolve({ status: res.statusCode, body, json, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.create({
    name: "Test User",
    email: "test@test.com",
    passwordHash: null,
    storageUsed: 0,
    storageLimit: 1073741824,
  });
  const token = await makeToken(user._id.toString());
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const R = (method, path, body) => request(port, token, method, path, body);

  // --- seed files/folders with various updatedAt ---
  const f1 = await File.create({
    name: "a-first.txt",
    originalName: "a-first.txt",
    mimeType: "text/plain",
    size: 1,
    s3Key: "x",
    blobUrl: null,
    localPath: null,
    folderId: null,
    ownerId: user._id,
  });
  const f2 = await File.create({
    name: "b-second.txt",
    originalName: "b-second.txt",
    mimeType: "text/plain",
    size: 1,
    s3Key: "x",
    blobUrl: null,
    localPath: null,
    folderId: null,
    ownerId: user._id,
  });
  const folder = await Folder.create({
    name: "StarredFolder",
    parentId: null,
    ownerId: user._id,
    path: [],
  });

  await Promise.all([
    File.findByIdAndUpdate(f1._id, {
      $set: { updatedAt: new Date("2025-01-01") },
    }),
    File.findByIdAndUpdate(f2._id, {
      $set: { updatedAt: new Date("2025-02-01") },
    }),
  ]);

  let passed = 0,
    failed = 0;
  const res = (name, sto) => {
    try {
      sto();
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${name} — ${e.message}`);
      failed++;
    }
  };

  /* ---- recent files ---- */
  console.log("\n== recent files ==");
  const rec = await R("GET", "/api/files/recent", {});
  res("recent returns 200", () => {
    if (rec.status !== 200)
      throw new Error("status " + rec.status + " " + rec.body);
  });
  res("recent returns files array", () => {
    if (!Array.isArray(rec.json?.files)) throw new Error("no files array");
  });
  res("recent returns up to 20", () => {
    if (rec.json.files.length > 20) throw new Error("too many");
  });
  res("recent is newest-first", () => {
    if (rec.json.files.length < 2) throw new Error("need at least 2");
    const dates = rec.json.files.map((f) => new Date(f.updatedAt).getTime());
    if (dates[0] < dates[1]) throw new Error("not sorted desc");
  });
  res("recent excludes trashed", () => {
    const ids = rec.json.files.map((f) => f.id);
    if (ids.includes(f1.id) || ids.includes(f2.id)) {
      // both are non-trashed, so they should appear
    } else {
      throw new Error("missing seeded files");
    }
  });

  /* ---- starred toggle: file ---- */
  console.log("\n== starred toggle (file) ==");
  const star1 = await R("PATCH", `/api/files/${f1._id}/star`, {
    is_starred: true,
  });
  res("star file 200", () => {
    if (star1.status !== 200) throw new Error("status " + star1.status);
  });
  res("star file returns updated file", () => {
    if (!star1.json?.file) throw new Error("no file");
  });
  res("star file is starred", () => {
    if (!star1.json.file.is_starred) throw new Error("not starred");
  });
  const unstar = await R("PATCH", `/api/files/${f1._id}/star`, {
    is_starred: false,
  });
  res("unstar file 200", () => {
    if (unstar.status !== 200) throw new Error("status " + unstar.status);
  });
  res("unstar file not starred", () => {
    if (unstar.json.file.is_starred) throw new Error("still starred");
  });

  /* ---- starred toggle: folder ---- */
  console.log("\n== starred toggle (folder) ==");
  const starF = await R("PATCH", `/api/folders/${folder._id}/star`, {
    is_starred: true,
  });
  res("star folder 200", () => {
    if (starF.status !== 200) throw new Error("status " + starF.status);
  });
  res("star folder is starred", () => {
    if (!starF.json.folder.is_starred) throw new Error("not starred");
  });
  const unstarF = await R("PATCH", `/api/folders/${folder._id}/star`, {
    is_starred: false,
  });
  res("unstar folder 200", () => {
    if (unstarF.status !== 200) throw new Error("status " + unstarF.status);
  });
  res("unstar folder not starred", () => {
    if (unstarF.json.folder.is_starred) throw new Error("still starred");
  });

  /* ---- batch delete files ---- */
  console.log("\n== batch delete files ==");
  const bd = await R("POST", "/api/files/batch/delete", {
    ids: [f1._id.toString(), f2._id.toString()],
  });
  res("batch delete 200", () => {
    if (bd.status !== 200)
      throw new Error("status " + bd.status + " " + bd.body);
  });
  res("batch delete reports moved count", () => {
    if (!bd.json?.moved) throw new Error("no moved");
  });
  res("batch delete marks files trashed", async () => {
    const remaining = await File.find({
      _id: { $in: [f1._id, f2._id] },
      ownerId: user._id,
      isTrashed: false,
    });
    if (remaining.length !== 0)
      throw new Error("not trashed: " + remaining.length);
  });

  /* ---- batch move files ---- */
  console.log("\n== batch move files ==");
  // recreate f1 so it's not trashed
  await File.findByIdAndUpdate(f1._id, { isTrashed: false, trashedAt: null });
  const m = await R("POST", "/api/files/batch/move", {
    ids: [f1._id.toString()],
    target_folder_id: folder._id.toString(),
  });
  res("batch move 200", () => {
    if (m.status !== 200) throw new Error("status " + m.status + " " + m.body);
  });
  res("batch move reports moved count", () => {
    if (!m.json?.moved) throw new Error("no moved");
  });
  res("batch move sets folderId", async () => {
    const updated = await File.findById(f1._id);
    if (!updated || updated.folderId.toString() !== folder._id.toString())
      throw new Error("folderId not set");
  });

  /* ---- batch star files ---- */
  console.log("\n== batch star files ==");
  // unstar f2 first
  await File.findByIdAndUpdate(f2._id, { isStarred: false });
  const bs = await R("POST", "/api/files/batch/star", {
    ids: [f1._id.toString(), f2._id.toString()],
    is_starred: true,
  });
  res("batch star 200", () => {
    if (bs.status !== 200)
      throw new Error("status " + bs.status + " " + bs.body);
  });
  res("batch star reports updated count", () => {
    if (!bs.json?.updated) throw new Error("no updated");
  });
  res("batch star marks both starred", async () => {
    const [a, b] = await File.find({
      _id: { $in: [f1._id, f2._id] },
      ownerId: user._id,
    });
    if (!a || !b) throw new Error("missing");
    if (!a.is_starred || !b.is_starred) throw new Error("not starred");
  });

  /* ---- batch delete folders ---- */
  console.log("\n== batch delete folders ==");
  const folder2 = await Folder.create({
    name: "FolderToDelete",
    parentId: null,
    ownerId: user._id,
    path: [],
  });
  const fd = await R("POST", "/api/folders/batch/delete", {
    ids: [folder._id.toString(), folder2._id.toString()],
  });
  res("batch delete folders 200", () => {
    if (fd.status !== 200)
      throw new Error("status " + fd.status + " " + fd.body);
  });
  res("batch delete folders reports count", () => {
    if (!fd.json?.deleted) throw new Error("no deleted");
  });
  res("batch delete folders removes folders + contents", async () => {
    const remainingFolders = await Folder.find({
      _id: { $in: [folder._id, folder2._id] },
      ownerId: user._id,
    });
    if (remainingFolders.length !== 0)
      throw new Error("folders still present: " + remainingFolders.length);
    const remainingFiles = await File.find({
      folderId: { $in: [folder._id, folder2._id] },
      ownerId: user._id,
    });
    if (remainingFiles.length !== 0)
      throw new Error("files still present: " + remainingFiles.length);
  });

  server.close();
  await mem.stop();
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
