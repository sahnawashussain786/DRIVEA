import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { authApi } from "../assets/api";
import { getAuthHeaders, setToken, getToken } from "../lib/auth-token";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// ---------------------------------------------------------------------------
// Standard JWT auth (no third-party provider).
// The token lives in localStorage and is attached to every request by the
// axios client. `user` is the server-side profile from GET /auth/me.
// ---------------------------------------------------------------------------

function mergeUser(serverUser) {
  return {
    id: serverUser?.id || null,
    name: serverUser?.name || "User",
    email: serverUser?.email || null,
    imageUrl: serverUser?.imageUrl || null,
    storage_used: Number(serverUser?.storage_used || 0),
    storage_limit: Number(serverUser?.storage_limit || 0),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  // Reload the current user from the server using the stored token.
  const refresh = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const serverUser = await authApi.me();
      setUser(mergeUser(serverUser));
      return serverUser;
    } catch (err) {
      console.error("[auth] /auth/me failed:", err);
      // The axios 401 interceptor clears the token and redirects; this
      // handler only makes sure the context settles into a signed-out
      // state if /auth/me failed for another reason (e.g. network error).
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    // Best-effort server call; the session is stateless, so what matters is
    // dropping the local token and resetting the context.
    try {
      await authApi.logout();
    } catch {}
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { user: serverUser, token } = await authApi.login({
      email,
      password,
    });
    setToken(token);
    await refresh();
    return serverUser;
  }, [refresh]);

  const register = useCallback(async ({ name, email, password }) => {
    const { user: serverUser, token } = await authApi.register({
      name,
      email,
      password,
    });
    setToken(token);
    await refresh();
    return serverUser;
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
        logout,
        updateUser,
        login,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// UserButton — simple local-avatar + dropdown with user info and log out.
// ---------------------------------------------------------------------------

export function UserButton({ afterSignOutUrl, className, ...props }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const initials = (user?.name || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={`relative ${className || ""}`} {...props}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-semibold w-9 h-9 hover:bg-indigo-500 focus:outline-none"
        title={user?.email || user?.name || "Account"}
      >
        {initials || "U"}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg z-50 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.name || "User"}
            </p>
            {user?.email && (
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 px-3 py-2 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
