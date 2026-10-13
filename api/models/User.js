import mongoose from 'mongoose';
import { toJSON } from '../utils/transforms.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: 'User' },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    storageUsed: { type: Number, default: 0 },
    storageLimit: { type: Number, default: 1073741824 }, // 1 GB
  },
  { timestamps: true }
);

userSchema.set('toJSON', { transform: toJSON('user') });

export default mongoose.models.User || mongoose.model('User', userSchema);
