import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import http from 'http';
import { createApp } from './server/app.js';
import File from './server/models/File.js';
import User from './server/models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'drivea_dev_secret_change_me';
async function makeToken(sub) {
  return jwt.sign({ sub, email: 'test@test.com' }, JWT_SECRET, { expiresIn: '30d' });
}
function request(port, token, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ hostname: '127.0.0.1', port, path, method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' } }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
async function main() {
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.create({ name: 'u', email: 'u@u.com', passwordHash: null, storageUsed: 0, storageLimit: 1e9 });
  const token = await makeToken(user._id.toString());
  const app = createApp();
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const recent = await request(port, token, 'GET', '/api/files/recent');
  console.log('RECENT status:', recent.status);
  console.log('RECENT body:', JSON.stringify(recent.body));

  const f = await File.create({ name: 't.txt', originalName: 't.txt', mimeType: 'text/plain', size: 1, s3Key: 'x', blobUrl: null, localPath: null, folderId: null, ownerId: user._id });
  const star = await request(port, token, 'PATCH', `/api/files/${f._id}/star`, { is_starred: true });
  console.log('STAR status:', star.status);
  console.log('STAR body:', JSON.stringify(star.body));

  const unstar = await request(port, token, 'PATCH', `/api/files/${f._id}/star`, { is_starred: false });
  console.log('UNSTAR status:', unstar.status);
  console.log('UNSTAR body:', JSON.stringify(unstar.body));

  server.close();
  await mem.stop();
}
main().catch(e => { console.error(e); process.exit(1); });
