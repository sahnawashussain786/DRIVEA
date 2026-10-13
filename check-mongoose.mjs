import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
console.log('mongoose type:', typeof mongoose);
console.log('mongoose.connect type:', typeof mongoose.connect);
console.log('mongoose.default type:', typeof (mongoose.default));
console.log('mongoose.default.connect type:', typeof (mongoose.default && mongoose.default.connect));
const mem = await MongoMemoryServer.create();
const uri = mem.getUri();
console.log('uri:', uri);
try {
  await mongoose.connect(uri);
  console.log('connect OK');
} catch (e) {
  console.log('connect ERROR:', e.message);
  if (mongoose.default && typeof mongoose.default.connect === 'function') {
    await mongoose.default.connect(uri);
    console.log('connect via default OK');
  }
}
await mem.stop();
