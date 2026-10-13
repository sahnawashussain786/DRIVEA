/**
 * Bridge between Clerk's React auth hook and the axios API client.
 *
 * Clerk's useAuth().getToken() is async (returns a Promise<string>), so the
 * axios request interceptor must await it. This module holds mutable suppliers
 * that a top-level component keeps in sync on every render.
 */
let tokenSupplier = null;
let signOutSupplier = null;

export const setTokenSupplier = (fn) => {
  tokenSupplier = fn;
};

export const setSignOutSupplier = (fn) => {
  signOutSupplier = fn;
};

export const getAuthHeaders = async () => {
  try {
    const token = await tokenSupplier?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

export const clearTokenSupplier = () => {
  tokenSupplier = null;
  signOutSupplier = null;
};
