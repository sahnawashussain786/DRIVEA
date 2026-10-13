import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../context/AuthContext";
import { getErrMessage } from "../assets/api";
import {
    CloudIcon,
    ShieldCheckIcon,
    ZapIcon,
    Share2Icon,
    FolderIcon,
    HardDriveIcon,
} from "lucide-react";

const FEATURES = [
    { Icon: CloudIcon, title: "Store anything", desc: "Files, folders and media up to 1 GB free" },
    { Icon: ShieldCheckIcon, title: "Private by default", desc: "JWT-secured accounts, owner-scoped access" },
    { Icon: Share2Icon, title: "Share in one click", desc: "Public links anyone can open" },
    { Icon: ZapIcon, title: "Fast & reliable", desc: "Serverless API on Vercel edge network" },
];

const Login = ({ mode = "login" }) => {
    const isRegister = mode === "register";
    const navigate = useNavigate();
    const { login, register } = useAuth();

    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState(null);

    const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(null);
        setIsLoading(true);
        try {
            if (isRegister) await register(form);
            else await login({ email: form.email, password: form.password });
            toast.success(isRegister ? "Account created. Welcome!" : "Welcome back!");
            navigate("/", { replace: true });
        } catch (err) {
            const msg = getErrMessage(err);
            setFormError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen text-zinc-900 flex flex-col md:flex-row">
            {/* Left hero brand panel */}
            <div className="md:w-1/2 p-8 md:p-12 lg:p-16 bg-linear-to-br from-orange-50 via-zinc-100 to-red-50 border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col justify-between relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-3">
                    <img className="max-h-9" src="/logo.svg" alt="Drivea logo" />
                    <span className="text-2xl font-semibold tracking-tight">Drivea</span>
                </div>

                <div className="relative z-10 py-10 md:py-0">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight mb-3">
                        Your cloud drive,<br />beautifully simple.
                    </h1>
                    <p className="text-zinc-500 max-w-md mb-10">
                        Drag, drop, and share your files from anywhere. Everything you need to store
                        and manage your data — free to start.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {FEATURES.map(({ Icon, title, desc }) => (
                            <div key={title} className="flex gap-3 p-4 rounded-xl bg-white/70 border border-zinc-200 backdrop-blur">
                                <div className="size-9 shrink-0 rounded-lg bg-orange-600/10 text-orange-600 flex items-center justify-center">
                                    <Icon className="size-4.5" />
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

            {/* Right auth form */}
            <div className="md:w-1/2 flex items-center justify-center p-8 md:p-12 bg-white">
                <div className="w-full max-w-sm">
                    <div className="mb-8">
                        <div className="size-11 rounded-xl bg-orange-600 text-white flex items-center justify-center mb-4 shadow-sm">
                            <CloudIcon className="size-5" />
                        </div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            {isRegister ? "Create your account" : "Sign in to Drivea"}
                        </h2>
                        <p className="text-sm text-zinc-500 mt-1">
                            {isRegister
                                ? "Free forever for your first gigabyte."
                                : "Welcome back! Please enter your details."}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegister && (
                            <Input
                                label="Full name"
                                placeholder="John Doe"
                                value={form.name}
                                onChange={(e) => updateField("name", e.target.value)}
                            />
                        )}
                        <Input
                            label="Email"
                            type="email"
                            required
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={(e) => updateField("email", e.target.value)}
                        />
                        <div>
                            <Input
                                label="Password"
                                type="password"
                                required
                                minLength={isRegister ? 6 : undefined}
                                placeholder="••••••••"
                                value={form.password}
                                onChange={(e) => updateField("password", e.target.value)}
                            />
                            {isRegister && form.password && form.password.length < 6 && (
                                <p className="text-xs text-amber-600 mt-1">Password must be at least 6 characters.</p>
                            )}
                        </div>

                        <Button type="submit" className="w-full" isLoading={isLoading} disabled={isLoading}>
                            {isRegister ? "Create account" : "Sign in"}
                        </Button>

                        <p className="text-center text-sm text-zinc-500">
                            {isRegister ? "Already have an account? " : "Don't have an account? "}
                            <Link
                                to={isRegister ? "/login" : "/register"}
                                className="text-orange-600 hover:text-orange-700 font-medium"
                            >
                                {isRegister ? "Sign in" : "Sign up"}
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
