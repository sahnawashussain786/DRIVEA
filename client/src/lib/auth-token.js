/**
 * Token bridge between the AuthContext / API client and localStorage.
 *
 * Standard JWT auth: the token is issued by POST /auth/login or
 * POST /auth/register and stored in localStorage. The axios request
 * interceptor awaits getAuthHeaders() so it stays async-compatible.
 */
const TOKEN_KEY = "drivea_token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

export const getAuthHeaders = async () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
