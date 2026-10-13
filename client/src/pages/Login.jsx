import { Link } from "react-router-dom";
import { HardDriveIcon } from "lucide-react";
import { ClerkSignIn, ClerkSignUp } from "../context/AuthContext";

/**
 * Auth-centered login/register pages.
 * Clean, focused layout: logo + heading at top, Clerk form below, minimal
 * surrounding chrome. No marketing/feature panels competing with the form.
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

          {/* Clerk form */}
          <div className="flex flex-col">
            {children}
          </div>

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

export default function Login() {
  return (
    <AuthPage
      title="Sign in to Drivea"
      subtitle="Welcome back! Sign in to access your files."
    >
      <ClerkSignIn afterSignInUrl="/" afterSignUpUrl="/" />
    </AuthPage>
  );
}

/** Register page — Clerk handles the full sign-up flow (email verification, OAuth, etc.). */
export function Register() {
  return (
    <AuthPage
      title="Create your account"
      subtitle="Free forever for your first gigabyte."
    >
      <ClerkSignUp afterSignInUrl="/" afterSignUpUrl="/" />
    </AuthPage>
  );
}
