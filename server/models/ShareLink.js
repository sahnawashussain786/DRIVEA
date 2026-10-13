import mongoose from 'mongoose';
import { toJSON } from '../utils/transforms.js';

const shareLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    resourceType: { type: String, enum: ['file', 'folder'], required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    permission: { type: String, enum: ['view', 'download'], default: 'download' },
    expiresAt: { type: Date, default: null },
    accessCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

shareLinkSchema.set('toJSON', { transform: toJSON('share') });

export default mongoose.models.ShareLink || mongoose.model('ShareLink', shareLinkSchema);
