# Drivea

A cloud data storage app built with the MERN stack (MongoDB, Express, React, Node.js) and Tailwind CSS.

## Features

- **User authentication** — register and log in with email/password (JWT, 30-day expiry)
- **File management** — upload, rename, move, copy, star, and delete files
- **Folder organization** — nested folders with breadcrumb navigation, move, copy, and batch operations
- **Trash** — soft-delete files and folders, restore or permanently delete, empty trash
- **Sharing** — generate public share links for files and folders (view or download), with optional expiry and access tracking
- **Storage quota** — per-user storage accounting with a configurable limit (default 1 GB)
- **Download as ZIP** — download entire folders as a zip archive
- **Recent files** — quick access to recently updated files
- **Search** — find files by name across all folders
- **Multi-upload** — upload up to 20 files at once via multipart form
- **Direct blob upload** — large file support via Vercel Blob (production)

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Tailwind CSS (Vite) |
| Backend | Express (Node.js) |
| Database | MongoDB (or in-memory Mongo for dev) |
| File storage | Vercel Blob (production) / local disk (dev) |
| Auth | JWT (jsonwebtoken + bcryptjs) |

## Project structure

```
.
├── server/                 # Express API
│   ├── app.js              # App factory (routes + middleware + error handler)
│   ├── dev.js              # Local dev server (in-memory MongoDB fallback)
│   ├── config/db.js        # Mongoose connection (cached, single connection)
│   ├── middleware/auth.js  # JWT verification, user resolution, storage helpers
│   ├── models/             # Mongoose schemas (User, File, Folder, ShareLink)
│   ├── routes/             # API route handlers (auth, folders, files, trash, shares)
│   ├── services/storage.js # Vercel Blob + local dev file storage
│   └── utils/transforms.js # Consistent toJSON transformations for models
├── client/                 # React + Tailwind frontend
├── api/                    # Vercel serverless entry point
├── package.json            # Root package (monorepo-style scripts)
└── vercel.json             # Vercel deployment config (rewrites, headers)
```

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB (optional — see "Run without MongoDB" below)

### Install dependencies

```bash
npm install
cd client && npm install
```

### Environment variables

Copy `.env.example` to `.env` and fill in the values:

```
# Required
MONGODB_URI=          # MongoDB connection string (or leave blank for in-memory dev DB)

# Auth — set a strong secret in production
JWT_SECRET=           # defaults to "drivea_dev_secret_change_me" if unset

# Storage — Vercel Blob (production)
BLOB_READ_WRITE_TOKEN=   # Vercel Blob read/write token
VERCEL_BLOB_DOMAIN=      # optional, your blob domain

# Storage limit per user (default 1 GB = 1073741824 bytes)
STORAGE_LIMIT_BYTES=1073741824
```

### Run without MongoDB

If `MONGODB_URI` is not set, the dev server starts an in-memory MongoDB instance automatically. Great for local development and testing.

### Start the dev server

```bash
# Terminal 1 — API
npm run dev:api      # starts on http://localhost:4000

# Terminal 2 — Frontend
npm run dev:client   # starts the Vite dev server
```

The API exposes a health endpoint at `/api/health`.

## API overview

All authenticated routes require a `Bearer <token>` header from `/auth/register` or `/auth/login`.

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Create account (name, email, password) → returns user + JWT |
| `POST /api/auth/login` | Log in (email, password) → returns user + JWT |
| `GET /api/auth/me` | Current user profile + storage info |
| `POST /api/auth/logout` | Logout (client-side token drop) |
| `GET /api/folders` | List folders (optionally by `parent_id`) |
| `POST /api/folders` | Create folder |
| `GET /api/folders/:id` | Folder detail + breadcrumbs |
| `PATCH /api/folders/:id/rename` | Rename folder |
| `PATCH /api/folders/:id/move` | Move folder (cycle-safe) |
| `POST /api/folders/:id/copy` | Copy folder + contents (checks quota) |
| `DELETE /api/folders/:id` | Soft-delete folder to trash |
| `POST /api/folders/:id/restore` | Restore folder from trash |
| `DELETE /api/folders/:id/permanent` | Permanently delete folder + contents |
| `POST /api/folders/batch/delete` | Batch permanently delete folders |
| `PATCH /api/folders/:id/star` | Toggle folder star |
| `GET /api/files` | List files (filter by `folder_id`, `search`, `sort`) |
| `POST /api/files/upload` | Multipart upload (up to 20 files) |
| `POST /api/files/register` | Register a blob-direct-uploaded file |
| `GET /api/files/:id/download` | Download file (or redirect to blob URL) |
| `GET /api/files/:id/preview` | Get preview URL |
| `PATCH /api/files/:id/rename` | Rename file |
| `PATCH /api/files/:id/move` | Move file to another folder |
| `DELETE /api/files/:id` | Soft-delete file to trash |
| `POST /api/files/:id/restore` | Restore file from trash |
| `DELETE /api/files/:id/permanent` | Permanently delete file + storage |
| `POST /api/files/:id/copy` | Copy file (checks quota) |
| `GET /api/files/folder/:id/download` | Download folder as ZIP |
| `GET /api/files/recent` | Recent files (default 20, max 100) |
| `PATCH /api/files/:id/star` | Toggle file star |
| `POST /api/files/batch/delete` | Batch move files to trash |
| `POST /api/files/batch/move` | Batch move files |
| `POST /api/files/batch/star` | Batch star/unstar files |
| `GET /api/trash` | List trashed files + folders |
| `POST /api/trash/empty` | Empty trash (permanently delete all) |
| `POST /api/shares` | Create share link (file or folder, view/download, optional expiry) |
| `GET /api/shares` | List own share links |
| `DELETE /api/shares/:id` | Revoke a share link |
| `GET /api/shares/access/:token` | Public: access a shared resource by token |

## Deployment

The project is set up for Vercel:

- `vercel.json` rewrites `/api/*` to the serverless entry point and serves the React build as a SPA
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) are applied globally

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev:api` | Start the Express API server |
| `npm run dev:client` | Start the Vite frontend dev server |
| `npm run build` | Build the client for production |

## License

Private project — see the repository for details.
