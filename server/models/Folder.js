import mongoose from 'mongoose';
import { toJSON } from '../utils/transforms.js';

const folderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: 'Untitled Folder' },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    path: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    isTrashed: { type: Boolean, default: false, index: true },
    trashedAt: { type: Date, default: null },
    isStarred: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

folderSchema.set('toJSON', { transform: toJSON('folder') });

export default mongoose.models.Folder || mongoose.model('Folder', folderSchema);
