import mongoose from 'mongoose';

let cached = global.__drivea_mongo;
if (!cached) cached = global.__drivea_mongo = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  cached.promise =
    cached.promise ||
    mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 30000,
    });

  cached.conn = await cached.promise;
  return cached.conn;
}
