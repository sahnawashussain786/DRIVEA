// Temporary diagnostic: shows the raw driver error when connecting to Atlas
import mongoose from 'mongoose';

export async function diagHandler(req, res) {
  const uri = process.env.MONGODB_URI;
  if (!uri) return res.json({ ok: false, stage: 'env', error: 'MONGODB_URI is not set' });

  // masked view so no credentials leak
  const masked = uri.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');

  try {
    const conn = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      family: 4,
    }).asPromise();
    const ping = await conn.db.admin().ping();
    await conn.close();
    return res.json({ ok: true, masked, ping });
  } catch (err) {
    return res.json({
      ok: false,
      masked,
      name: err.name,
      message: err.message?.slice(0, 400),
      code: err.code,
      codeName: err.codeName,
      reason: err.reason?.topologyDescription ? err.reason.topologyDescription.description : undefined,
      stackSplit: typeof err.message === 'string' ? err.message.split('\n').length : 0,
    });
  }
}
