# Drivea

A cloud storage web app built with React 19 + Vite + Tailwind CSS 4 on the frontend and Express 5 + MongoDB (Mongoose) on the backend, deployed on Vercel.

## Features

- Clerk authentication (sign-in, sign-up, OAuth, email verification, profile management)
- File upload (multipart + browser-direct Vercel Blob uploads), download, and preview
  - Image, video, audio, and PDF inline preview
- Folders: create, rename, move (with cycle protection), copy
- Trash: soft delete, restore, permanent delete, empty trash
- Storage quota: per-user 1 GB default, enforced on upload, shown in UI
- Grid and list views, sorting, searching, breadcrumbs
- Shared/public links (download permission) with create, copy, open, revoke
- Multi-select + batch actions on Drive (select, select-all, batch delete, batch move, batch share)
- Recent files view
- Starred / favorites
- Fully responsive across mobile, tablet, and desktop

## Environment variables

### Server (`.env` at project root)

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/drivea

# Optional: Vercel Blob for file storage (production). When absent, files are stored
# locally in .uploads/ (dev only).
BLOB_READ_WRITE_TOKEN=

# Optional: Clerk secret key. When set, the API uses Clerk session validation.
# When absent, the API falls back to the legacy JWT secret for local development.
CLERK_SECRET_KEY=

# Optional: legacy JWT secret (only used when CLERK_SECRET_KEY is absent).
JWT_SECRET=drivea_dev_secret_change_me

# Optional: per-user storage limit in bytes (default 1 GB).
STORAGE_LIMIT_BYTES=1073741824
```

### Client (`client/.env.local`)

```bash
# Clerk publishable key (required for sign-in / sign-up / UserButton to work).
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# API base URL (defaults to "/api". In dev, Vite proxies "/api" to localhost:4000).
VITE_API_URL=
```

## Getting started

1. Copy `.env.example` to `.env` at the project root and fill in `MONGODB_URI`.
2. Copy `client/.env.example` to `client/.env.local` and add your Clerk publishable key.
3. Install dependencies at the root and in the client:
   ```bash
   npm install
   cd client && npm install
   ```
4. Start the API server and the client:
   ```bash
   # Terminal 1: API on http://localhost:4000
   npm run dev:api

   # Terminal 2: Client on http://localhost:5173 (proxies /api to the API)
   npm run dev:client
   ```
5. Open http://localhost:5173. Sign in with Clerk to access My Drive.

## Deployment

The app is configured for Vercel:
- `vercel.json` builds the client and rewrites `/api/*` to `api/index.js` (the Express handler).
- Set the environment variables in your Vercel project dashboard before deploying.

## Notes

- When `CLERK_SECRET_KEY` is set, the API validates sessions with Clerk and uses the
  Clerk user ID as the account identifier. A local `users` document is provisioned
  lazily for storage accounting.
- When `CLERK_SECRET_KEY` is absent, the API falls back to the legacy JWT secret so
  local development without Clerk still works (legacy tokens only).
- File storage: in production with `BLOB_READ_WRITE_TOKEN`, files live in Vercel Blob;
  in dev they are stored locally in `.uploads/`. Folder zip download streams from blob
  URLs in production and from local disk in dev.
