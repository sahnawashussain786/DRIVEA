/**
 * Bridge between Clerk's React auth hook and the axios API client.
 *
 * Clerk's useAuth() hooks run inside React, so they can't be called directly
 * from the plain axios interceptor. This module holds mutable suppliers that a
 * top-level component (ApiTokenSync) keeps in sync on every render.
 */
let tokenSupplier = null;
let signOutSupplier = null;

export const setTokenSupplier = (fn) => {
  tokenSupplier = fn;
};

export const setSignOutSupplier = (fn) => {
  signOutSupplier = fn;
};

export const getAuthHeaders = () => {
  try {
    const token = tokenSupplier?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

export const clearTokenSupplier = () => {
  tokenSupplier = null;
  signOutSupplier = null;
};
