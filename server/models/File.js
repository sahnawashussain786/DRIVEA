import mongoose from 'mongoose';
import { toJSON } from '../utils/transforms.js';

const fileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    s3Key: { type: String, required: true },
    blobUrl: { type: String, default: null },
    localPath: { type: String, default: null }, // dev disk adapter only
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isTrashed: { type: Boolean, default: false, index: true },
    trashedAt: { type: Date, default: null },
    isStarred: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

fileSchema.set('toJSON', { transform: toJSON('file') });

export default mongoose.models.FileModel || mongoose.model('FileModel', fileSchema);
