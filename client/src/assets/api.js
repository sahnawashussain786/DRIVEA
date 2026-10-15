import axios from "axios";
import {
  SORT_OPTIONS,
  formatBytes,
  getFileIcon,
  copyShareLink,
} from "./assets";
import { toast } from "react-hot-toast";
import { getAuthHeaders, setToken } from "../lib/auth-token";

export { SORT_OPTIONS, formatBytes, getFileIcon, copyShareLink };

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use(async (config) => {
  Object.assign(config.headers, await getAuthHeaders());
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // A 401 means our token is missing/expired/invalid: clear it and send the
    // user back to the login page (only if we are not already there).
    if (error.response?.status === 401) {
      setToken(null);
      if (window.location.pathname !== "/login")
        window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const getErrMessage = (err) =>
  err?.response?.data?.error || err?.message || "Something went wrong";

/* ---------------- AUTH ---------------- */

export const authApi = {
  /**
   * Current user profile + storage accounting from the server.
   * Called by the AuthContext to fill storage_used / storage_limit.
   */
  async me() {
    const { data } = await api.get("/auth/me");
    return data.user;
  },
  /**
   * POST /auth/login — returns { user, token }.
   */
  async login({ email, password }) {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
  },

  /**
   * POST /auth/register — returns { user, token }.
   */
  async register({ name, email, password }) {
    const { data } = await api.post("/auth/register", { name, email, password });
    return data;
  },

  /**
   * Fire-and-forget server logout (stateless JWT on their side).
   */
  async logout() {
    try {
      await api.post("/auth/logout");
    } catch {}
  },
};

/* ---------------- FOLDERS ---------------- */

export const folderApi = {
  async list(parent_id) {
    const params = parent_id === undefined ? {} : { parent_id };
    const { data } = await api.get("/folders", { params });
    return data.folders;
  },
  async get(id) {
    const { data } = await api.get(`/folders/${id}`);
    return { folder: data.folder, breadcrumbs: data.breadcrumbs || [] };
  },
  async create({ name, parent_id }) {
    const { data } = await api.post("/folders", { name, parent_id });
    return data.folder;
  },
  async rename(id, name) {
    const { data } = await api.patch(`/folders/${id}/rename`, { name });
    return data.folder;
  },
  async move(id, target_parent) {
    const { data } = await api.patch(`/folders/${id}/move`, { target_parent });
    return data.folder;
  },
  async trash(id) {
    await api.delete(`/folders/${id}`);
  },
  async restore(id) {
    const { data } = await api.post(`/folders/${id}/restore`);
    return data.folder;
  },
  async deletePermanent(id) {
    await api.delete(`/folders/${id}/permanent`);
  },
  async copy(id, { target_parent_id, name } = {}) {
    const { data } = await api.post(`/folders/${id}/copy`, {
      target_parent_id,
      name,
    });
    return data.folder;
  },
};

/* ---------------- FILES ---------------- */

export const fileApi = {
  async list(opts = {}) {
    const params = {};
    if ("folder_id" in opts) params.folder_id = opts.folder_id ?? null;
    if (opts.search) params.search = opts.search;
    if (opts.sort) params.sort = opts.sort;
    const { data } = await api.get("/files", { params });
    return data.files;
  },
  async preview(id) {
    const { data } = await api.get(`/files/${id}/preview`);
    return data.url || data.preview_url;
  },
  async rename(id, name) {
    const { data } = await api.patch(`/files/${id}/rename`, { name });
    return data.file;
  },
  async move(id, target_folder) {
    const { data } = await api.patch(`/files/${id}/move`, { target_folder });
    return data.file;
  },
  async trash(id) {
    await api.delete(`/files/${id}`);
  },
  async restore(id) {
    const { data } = await api.post(`/files/${id}/restore`);
    return data.file;
  },
  async deletePermanent(id) {
    await api.delete(`/files/${id}/permanent`);
  },

  async copy(id, { target_folder_id, name } = {}) {
    const { data } = await api.post(`/files/${id}/copy`, {
      target_folder_id,
      name,
    });
    return data.file;
  },

  /**
   * Upload one or more files.
   * - Local/dev: single multipart POST to /files/upload
   * - Production: tries /files/upload first (works within serverless body limits);
   *   the server rejects oversized payloads with a 413 we surface as a toast.
   * onProgress(done, total) reports aggregate progress.
   */
  async upload(files, folderId, onProgress) {
    const list = Array.from(files);
    const totalSize = list.reduce((acc, f) => acc + f.size, 0);
    onProgress?.(0, totalSize);

    const results = [];
    for (const file of list) {
      const form = new FormData();
      form.append("files", file);
      form.append("folder_id", folderId ?? "null");

      const { data } = await api.post("/files/upload", form, {
        onUploadProgress: (e) => onProgress?.(e.loaded, totalSize),
      });
      results.push(...(data.files || [data.file].filter(Boolean)));
    }
    onProgress?.(totalSize, totalSize);
    return results;
  },

  /**
   * Download an entire folder as a zip.
   * Fetches the streamed zip with the auth token and triggers a browser download.
   * Note: the zip is held in memory during the fetch, so very large folders may
   * use significant memory. For huge exports, consider server-side async export.
   */
  async downloadFolderZip(id) {
    const { data } = await folderApi.get(id);
    const folderName = data.folder?.name || 'folder';
    const token = await getAuthHeaders().then((h) => h.Authorization);

    const url = `/files/folder/${id}/download`;
    const res = await fetch(url, {
      headers: token ? { Authorization: token } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${folderName.replace(/[\\/\?%*<>\|]/g, '_')}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  },
};

/* ---------------- TRASH ---------------- */

export const trashApi = {
  async list() {
    const { data } = await api.get("/trash");
    return { files: data.files, folders: data.folders };
  },
  async empty() {
    await api.post("/trash/empty");
  },
};

/* ---------------- SHARES ---------------- */

export const shareApi = {
  async create({
    resource_id,
    resource_type = "file",
    permission = "download",
  }) {
    const { data } = await api.post("/shares", {
      resource_id,
      resource_type,
      permission,
    });
    return data.share || data.share_link;
  },
  async list() {
    const { data } = await api.get("/shares");
    return data.share_links || data.shares;
  },
  async revoke(id) {
    await api.delete(`/shares/${id}`);
  },
  async access(token) {
    const { data } = await api.get(`/shares/access/${token}`);
    return data;
  },
};

export default api;
