import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import http from 'http';
import { createApp } from './server/app.js';
import File from './server/models/File.js';
import Folder from './server/models/Folder.js';
import User from './server/models/User.js';
import { storeFile } from './server/services/storage.js';

const JWT_SECRET = process.env.JWT_SECRET || 'drivea_dev_secret_change_me';

async function makeToken(sub) {
  return jwt.sign({ sub, email: 'test@test.com' }, JWT_SECRET, { expiresIn: '30d' });
}

function request(port, token, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        let json = null;
        try { json = body ? JSON.parse(body) : null; } catch {}
        resolve({ status: res.statusCode, body, json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.create({
    name: 'Test User',
    email: 'test@test.com',
    passwordHash: null,
    storageUsed: 0,
    storageLimit: 1073741824,
  });
  const token = await makeToken(user._id.toString());
  // sanity: verify the legacy token ourselves
  const v = jwt.verify(token, JWT_SECRET);
  if (v.sub !== user._id.toString()) throw new Error('token sub mismatch: ' + v.sub + ' vs ' + user._id);
  console.log('token verifies OK, sub=', v.sub);

  // sanity: call requireAuth directly with a mock req/res
  const { requireAuth } = await import('./server/middleware/auth.js');
  const mockReq = { headers: { authorization: `Bearer ${token}` } };
  let calledNext = false;
  const mockRes = {
    status: (n) => { mockRes.statusCode = n; return mockRes; },
    json: (obj) => { mockRes.body = obj; return mockRes; },
  };
  requireAuth(mockReq, mockRes, () => { calledNext = true; });
  if (!calledNext) {
    const usedSecret = process.env.JWT_SECRET || 'drivea_dev_secret_change_me';
    const freshVerify = jwt.verify(token, usedSecret);
    console.log('DEBUG requireAuth rejected; secret used=', JSON.stringify(usedSecret), '; our verify of same secret OK, sub=', freshVerify.sub, '; mockRes.body=', JSON.stringify(mockRes.body));
    throw new Error('requireAuth legacy rejected: ' + JSON.stringify(mockRes.body));
  }
  console.log('requireAuth legacy passes, req.userId=', mockReq.userId);

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const R = (method, path, body) => request(port, token, method, path, body);

  let passed = 0;
  let failed = 0;
  function assert(name, fn) {
    try {
      fn();
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${name} — ${e.message}`);
      failed++;
    }
  }
  function res(name, sto) { try { sto(); passed++; } catch (e) { console.log(`  FAIL: ${name} — ${e.message}`); failed++; } }

  /* ---- seed: a root text file with real stored content ---- */
  const srcFile = await File.create({
    name: 'hello.txt',
    originalName: 'hello.txt',
    mimeType: 'text/plain',
    size: 11,
    s3Key: 'x',
    blobUrl: null,
    localPath: null,
    folderId: null,
    ownerId: user._id,
  });
  const { localPath } = await storeFile(user._id.toString(), 'hello.txt', Buffer.from('hello world'), 'text/plain');
  await File.findByIdAndUpdate(srcFile._id, { localPath });

  /* ---- copy file (root -> root, renamed) ---- */
  console.log('\n== copy file ==');
  const cr = await R('POST', `/api/files/${srcFile._id}/copy`, { name: 'hello-copy.txt' });
  res('copy returns 201', () => { if (cr.status !== 201) throw new Error('status ' + cr.status + ' ' + cr.body); });
  const copyFile = cr.json.file;
  res('copy has new id', () => { if (copyFile.id === srcFile.id) throw new Error('same id'); });
  res('copy name correct', () => { if (copyFile.name !== 'hello-copy.txt') throw new Error(copyFile.name); });
  res('copy size preserved', () => { if (copyFile.size !== 11) throw new Error('size ' + copyFile.size); });
  res('copy is independent (own localPath)', () => { if (!copyFile.localPath || copyFile.localPath === srcFile.localPath) throw new Error('localPath ' + (copyFile.localPath || '')); });
  const u1 = await User.findById(user._id);
  res('storage increased by 11 (now 11)', () => { if (u1.storageUsed !== 11) throw new Error('storageUsed ' + u1.storageUsed); });

  /* ---- copy file into a folder ---- */
  console.log('\n== copy file into folder ==');
  const folder = await Folder.create({ name: 'Copies', parentId: null, ownerId: user._id, path: [] });
  const ci = await R('POST', `/api/files/${srcFile._id}/copy`, { target_folder_id: folder._id.toString(), name: 'in-folder.txt' });
  res('copy into folder 201', () => { if (ci.status !== 201) throw new Error('status ' + ci.status); });
  res('copy into folder has folderId', () => { if (ci.json.file.folder_id !== folder._id.toString()) throw new Error('folder_id ' + (ci.json.file.folder_id || '')); });
  const u2 = await User.findById(user._id);
  res('storage now 22 (11 + 11)', () => { if (u2.storageUsed !== 22) throw new Error('storageUsed ' + u2.storageUsed); });

  /* ---- copy folder recursively ---- */
  console.log('\n== copy folder (recursive) ==');
  const sub = await Folder.create({ name: 'Sub', parentId: folder._id, ownerId: user._id, path: [folder._id] });
  const innerFile = await File.create({
    name: 'inner.txt', originalName: 'inner.txt', mimeType: 'text/plain', size: 5,
    s3Key: 'x', blobUrl: null, localPath: null, folderId: sub._id, ownerId: user._id,
  });
  const innerMeta = await storeFile(user._id.toString(), 'inner.txt', Buffer.from('hello'), 'text/plain');
  await File.findByIdAndUpdate(innerFile._id, { localPath: innerMeta.localPath });

  const cf = await R('POST', `/api/folders/${folder._id}/copy`, { name: 'Copies-Copy', target_parent_id: null });
  res('copy folder 201', () => { if (cf.status !== 201) throw new Error('status ' + cf.status + ' ' + cf.body); });
  const newRoot = cf.json.folder;
  res('copied root name', () => { if (newRoot.name !== 'Copies-Copy') throw new Error(newRoot.name); });
  res('copied root no parent', () => { if (newRoot.parent_id !== null) throw new Error('parent_id ' + newRoot.parent_id); });
  const copiedSubs = await Folder.find({ ownerId: user._id, name: 'Sub', parentId: newRoot._id });
  res('copied subtree has subfolder', () => { if (copiedSubs.length !== 1) throw new Error('subs ' + copiedSubs.length); });
  const copiedSub = copiedSubs[0];
  const copiedInner = await File.findOne({ ownerId: user._id, name: 'inner.txt', folderId: copiedSub._id });
  res('copied subtree has inner file', () => { if (!copiedInner) throw new Error('inner file missing'); });
  res('copied inner file independent localPath', () => { if (!copiedInner.localPath || copiedInner.localPath === innerFile.localPath) throw new Error('localPath'); });
  const u3 = await User.findById(user._id);
  // 22 + 16 (copies of in-folder.txt 11 + inner.txt 5) = 38
  res('storage now 38 after folder copy', () => { if (u3.storageUsed !== 38) throw new Error('storageUsed ' + u3.storageUsed); });

  /* ---- folder zip download ---- */
  console.log('\n== folder zip download ==');
  const zip = await R('GET', `/api/files/folder/${newRoot._id}/download`);
  res('zip status 200', () => { if (zip.status !== 200) throw new Error('status ' + zip.status + ' ' + zip.body); });
  res('zip content-type application/zip', () => {
    const ct = (zip.headers && zip.headers['content-type']) || '';
    if (!ct.startsWith('application/zip')) throw new Error('ctype ' + ct);
  });
  res('zip body non-empty', () => { if (zip.body.length < 2) throw new Error('len ' + zip.body.length); });
  res('zip starts with PK', () => { if (zip.body.charCodeAt(0) !== 80 || zip.body.charCodeAt(1) !== 75) throw new Error('not zip'); });

  /* ---- quota enforcement on copy ---- */
  console.log('\n== quota enforcement ==');
  await User.findByIdAndUpdate(user._id, { storageLimit: 30 });
  const over = await R('POST', `/api/files/${srcFile._id}/copy`, { name: 'too-big.txt' });
  res('copy denied 413 when over quota', () => { if (over.status !== 413) throw new Error('status ' + over.status + ' ' + over.body); });
  res('copy denied error mentions storage', () => {
    if (!over.json || !over.json.error || !over.json.error.toLowerCase().includes('storage')) throw new Error('msg ' + (over.body || ''));
  });

  server.close();
  await mem.stop();
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
