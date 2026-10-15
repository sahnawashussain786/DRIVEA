import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HardDriveIcon, LoaderCircleIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Auth-centered login/register pages.
 * Standard email + password forms (JWT). Same clean card layout as before:
 * logo + heading at top, form in the middle, minimal surrounding chrome.
 */
function AuthPage({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="flex items-center gap-2.5 text-slate-800">
            <img className="max-h-8" src="/logo.svg" alt="Drivea" />
            <span className="text-xl font-semibold tracking-tight">Drivea</span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500 mt-1.5">{subtitle}</p>
          </div>

          {children}

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-400">
            By continuing, you agree to our Terms and Privacy Policy.
          </p>
        </div>

        {/* Bottom hint */}
        <p className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <HardDriveIcon className="size-3.5" /> 1 GB free storage · folders · share links
        </p>
      </div>
    </div>
  );
}

const inputClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

function AuthForm({ mode }) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  const getErrMessage = (err) =>
    err?.response?.data?.error || err?.message || "Something went wrong";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) await register({ name, email, password });
      else await login({ email, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {isRegister && (
        <div>
          <label htmlFor="auth-name" className="block text-sm font-medium text-slate-700 mb-1.5">
            Name
          </label>
          <input
            id="auth-name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            className={inputClasses}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}

      <div>
        <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClasses}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1.5">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          required
          minLength={6}
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder={isRegister ? "At least 6 characters" : "Your password"}
          className={inputClasses}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        {busy && (
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
        )}
        {isRegister ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-500">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Drivea?{" "}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Create a free account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

export default function Login() {
  return (
    <AuthPage
      title="Sign in to Drivea"
      subtitle="Welcome back! Sign in to access your files."
    >
      <AuthForm mode="login" />
    </AuthPage>
  );
}

/** Register page — creates the account with name, email and password. */
export function Register() {
  return (
    <AuthPage
      title="Create your account"
      subtitle="Free forever for your first gigabyte."
    >
      <AuthForm mode="register" />
    </AuthPage>
  );
}
