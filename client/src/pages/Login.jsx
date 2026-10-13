import { Link } from "react-router-dom";
import { CloudIcon, HardDriveIcon, FolderIcon } from "lucide-react";
import { ClerkSignIn, ClerkSignUp } from "../context/AuthContext";

const FEATURES = [
  { Icon: CloudIcon, title: "Store anything", desc: "Files, folders and media up to 1 GB free" },
  { Icon: HardDriveIcon, title: "Folders & trash", desc: "Organize with folders and recover from trash" },
  { Icon: FolderIcon, title: "Share in one click", desc: "Public links anyone can open" },
];

function BrandedWrapper({ children, title, subtitle }) {
  return (
    <div className="min-h-screen text-zinc-900 flex flex-col md:flex-row">
      {/* Left branding panel */}
      <div className="md:w-1/2 p-8 md:p-12 lg:p-16 bg-linear-to-br from-orange-50 via-zinc-100 to-red-50 border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col justify-between relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-3 mb-8">
          <Link to="/" className="flex items-center gap-3">
            <img className="max-h-9" src="/logo.svg" alt="Drivea logo" />
            <span className="text-2xl font-semibold tracking-tight">Drivea</span>
          </Link>
        </div>

        <div className="relative z-10 py-10 md:py-0">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight mb-3">
            Your cloud drive,<br />beautifully simple.
          </h1>
          <p className="text-zinc-500 max-w-md mb-10 text-sm md:text-base">
            Drag, drop, and share your files from anywhere. Everything you need to store
            and manage your data — free to start.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 md:p-4 rounded-xl bg-white/70 border border-zinc-200 backdrop-blur">
                <div className="size-8 md:size-9 shrink-0 rounded-lg bg-orange-600/10 text-orange-600 flex items-center justify-center">
                  <Icon className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 hidden md:flex items-center gap-6 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><HardDriveIcon className="size-3.5" /> 1 GB free storage</span>
          <span className="flex items-center gap-1.5"><FolderIcon className="size-3.5" /> Folders & trash</span>
        </div>
      </div>

      {/* Right: Clerk sign-in / sign-up */}
      <div className="md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-slate-700 mb-1">
              <img className="max-h-7" src="/logo.svg" alt="Drivea" />
              <span className="text-xl font-semibold tracking-tight">Drivea</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
            <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <BrandedWrapper
      title="Sign in to Drivea"
      subtitle="Welcome back! Sign in to access your files."
    >
      <ClerkSignIn afterSignInUrl="/" afterSignUpUrl="/" />
    </BrandedWrapper>
  );
}

/** Register page — Clerk handles the full sign-up flow (email verification, OAuth, etc.). */
export function Register() {
  return (
    <BrandedWrapper
      title="Create your account"
      subtitle="Free forever for your first gigabyte."
    >
      <ClerkSignUp afterSignInUrl="/" afterSignUpUrl="/" />
    </BrandedWrapper>
  );
}
