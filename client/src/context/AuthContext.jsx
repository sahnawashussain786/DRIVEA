import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useUser,
  UserButton as ClerkUserButton,
  SignIn as ClerkSignInComponent,
  SignUp as ClerkSignUpComponent,
} from "@clerk/clerk-react";
import { authApi } from "../assets/api";
import {
  setTokenSupplier,
  setSignOutSupplier,
  clearTokenSupplier,
} from "../lib/auth-token";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// ---------------------------------------------------------------------------
// Config context: lets components know whether Clerk is actually configured.
// When the publishable key is absent we avoid mounting Clerk hooks/components
// so the app doesn't throw, and instead shows a clear placeholder.
// ---------------------------------------------------------------------------
const ClerkConfigContext = createContext({ isConfigured: false });
export const useClerkConfigured = () =>
  useContext(ClerkConfigContext).isConfigured;

function mergeUserProfile(clerkUser, serverUser) {
  return {
    id: clerkUser?.id || serverUser?.clerk_id || serverUser?.id || null,
    name:
      clerkUser?.fullName || clerkUser?.firstName || serverUser?.name || "User",
    email: clerkUser?.emailAddress || serverUser?.email || null,
    imageUrl: clerkUser?.imageUrl || null,
    storage_used: Number(serverUser?.storage_used || 0),
    storage_limit: Number(serverUser?.storage_limit || 0),
    clerk_id: clerkUser?.id || serverUser?.clerk_id || null,
  };
}

// ---------------------------------------------------------------------------
// Clerk-powered auth provider (mounted only when a publishable key is present).
// ---------------------------------------------------------------------------
function AuthProviderInner({ children }) {
  const clerkAuth = useClerkAuth();
  const clerkUser = useUser();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTokenSupplier(clerkAuth.getToken);
    setSignOutSupplier(clerkAuth.signOut);
    return () => {
      clearTokenSupplier();
    };
  }, [clerkAuth]);

  const refresh = useCallback(async () => {
    if (!clerkAuth.isLoaded || !clerkAuth.isSignedIn) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const serverUser = await authApi.me();
      setUser(mergeUserProfile(clerkUser, serverUser));
      return user;
    } catch (err) {
      console.error("[auth] /auth/me failed:", err);
      clerkAuth.signOut();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [clerkAuth, clerkUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (clerkAuth.isLoaded && clerkAuth.isSignedIn) {
      refresh();
    } else if (!clerkAuth.isSignedIn) {
      setUser(null);
      setLoading(false);
    }
  }, [clerkAuth.isSignedIn, clerkAuth.isLoaded]);

  const logout = useCallback(async () => {
    await clerkAuth.signOut();
    setUser(null);
  }, [clerkAuth]);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
        logout,
        updateUser,
        login: () => {
          window.location.href = "/login";
        },
        register: () => {
          window.location.href = "/register";
        },
      }}
    >
      <ClerkConfigContext.Provider value={{ isConfigured: true }}>
        {children}
      </ClerkConfigContext.Provider>
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Unconfigured auth provider — used when no Clerk publishable key is set.
// Provides a safe AuthContext (nobody is signed in) and avoids all Clerk hooks.
// ---------------------------------------------------------------------------
function UnconfiguredAuthProvider({ children }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The axios token/signOut bridges stay empty so the API client sends no auth
    // header and never tries to sign out.
    setTokenSupplier(null);
    setSignOutSupplier(null);
    return () => {
      clearTokenSupplier();
    };
  }, []);

  const logout = useCallback(async () => {}, []);
  const updateUser = useCallback((patch) => {}, []);

  return (
    <AuthContext.Provider
      value={{
        user: null,
        loading,
        refresh: async () => null,
        logout,
        updateUser,
        login: () => {
          window.location.href = "/login";
        },
        register: () => {
          window.location.href = "/register";
        },
      }}
    >
      <ClerkConfigContext.Provider value={{ isConfigured: false }}>
        {children}
      </ClerkConfigContext.Provider>
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Top-level provider.
// ---------------------------------------------------------------------------
export function AuthProvider({ children, publishableKey }) {
  const configured = Boolean(publishableKey);
  if (!configured) {
    return <UnconfiguredAuthProvider>{children}</UnconfiguredAuthProvider>;
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </ClerkProvider>
  );
}

// ---------------------------------------------------------------------------
// Guarded Clerk components — render real Clerk UI when configured, a placeholder
// when not, so the app never throws before Clerk keys are added.
// ---------------------------------------------------------------------------
function ClerkGate({ configured, children, fallback }) {
  if (!configured) return fallback;
  return children;
}

export function UserButton(props) {
  return (
    <ClerkGate
      configured={useClerkConfigured()}
      fallback={
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5"
          title="Sign in to manage your account"
        >
          Account
        </button>
      }
      {...props}
    >
      <ClerkUserButton {...props} afterSignOutUrl="/login" />
    </ClerkGate>
  );
}

export const ClerkSignIn = (props) => (
  <ClerkGate
    configured={useClerkConfigured()}
    fallback={
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-600 mb-3">
          Authentication is not configured yet.
        </p>
        <p className="text-xs text-slate-400">
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in your Clerk project’s
          environment variables (Production scope) and redeploy.
        </p>
      </div>
    }
    {...props}
  >
    <ClerkSignInComponent afterSignInUrl="/" afterSignUpUrl="/" {...props} />
  </ClerkGate>
);

export const ClerkSignUp = (props) => (
  <ClerkGate
    configured={useClerkConfigured()}
    fallback={
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-600 mb-3">
          Authentication is not configured yet.
        </p>
        <p className="text-xs text-slate-400">
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in your Clerk project’s
          environment variables (Production scope) and redeploy.
        </p>
      </div>
    }
    {...props}
  >
    <ClerkSignUpComponent afterSignInUrl="/" afterSignUpUrl="/" {...props} />
  </ClerkGate>
);
