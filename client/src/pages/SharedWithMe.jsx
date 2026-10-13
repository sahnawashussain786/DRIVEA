import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
    HardDriveIcon, Share2Icon, Link2Icon, CopyIcon, ExternalLinkIcon, TrashIcon, FolderIcon,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { shareApi, getFileIcon, copyShareLink, formatBytes } from "../assets/api";

const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

const SharedWithMe = () => {
    const [links, setLinks] = useState([]);
    const [isFetching, setIsFetching] = useState(true);
    const [revokeTarget, setRevokeTarget] = useState(null);

    const load = async () => {
        setIsFetching(true);
        try {
            const data = await shareApi.list();
            setLinks(data);
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to load shared links");
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const revoke = async () => {
        if (!revokeTarget) return;
        try {
            await shareApi.revoke(revokeTarget.id);
            setLinks((prev) => prev.filter((l) => l.id !== revokeTarget.id));
            toast.success("Share link revoked");
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to revoke link");
        } finally {
            setRevokeTarget(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 shrink-0 md:flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-white p-4">
                <Link to="/" className="flex items-center gap-2 px-2 py-1 mb-6">
                    <img className="max-h-8" src="/logo.svg" alt="Drivea" />
                    <span className="text-xl font-semibold tracking-tight">Drivea</span>
                </Link>
                <nav className="space-y-1 mb-0 md:mb-auto">
                    <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">
                        <HardDriveIcon className="size-4.5" /> My Drive
                    </Link>
                    <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm bg-orange-600/10 text-orange-700 font-medium">
                        <Share2Icon className="size-4.5" /> Shared Links
                    </Link>
                </nav>
            </aside>

            {/* Main */}
            <main className="flex-1 px-4 sm:px-8 py-6">
                <div className="mb-6">
                    <h1 className="text-xl font-semibold tracking-tight">Shared Links</h1>
                    <p className="text-sm text-slate-500">Every active public link you've created. Revoke instantly if needed.</p>
                </div>

                {isFetching ? (
                    <div className="flex justify-center py-24"><Spinner size="lg" /></div>
                ) : links.length === 0 ? (
                    <EmptyState
                        icon={Link2Icon}
                        title="No shared links yet"
                        description="Share a file or folder from My Drive and the public link will appear here."
                        action={<Link to="/"><Button variant="secondary">Back to My Drive</Button></Link>}
                    />
                ) : (
                    <div className="space-y-3">
                        {links.map((l) => (
                            <div key={l.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-white border border-slate-200 hover:border-orange-200 transition">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="size-10 shrink-0 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                        {l.resource_type === "folder" ? (
                                            <FolderIcon className="size-5 text-orange-500" />
                                        ) : (
                                            getFileIcon(l.resource?.mime_type, "size-5")
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{l.resource?.name || "Unknown item"}</p>
                                        <p className="text-[11px] text-slate-400">
                                            {l.resource_type === "folder" ? "Folder" : formatBytes(l.resource?.size || 0)} · shared {fmtDate(l.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => copyShareLink(l.token)}
                                        title="Copy link"
                                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                    >
                                        <CopyIcon className="size-4" />
                                    </button>
                                    <a href={`/s/${l.token}`} target="_blank" rel="noreferrer">
                                        <Button size="sm" variant="secondary" icon={ExternalLinkIcon}>Open</Button>
                                    </a>
                                    <Button size="sm" variant="ghost" icon={TrashIcon} className="text-red-600 hover:bg-red-50" onClick={() => setRevokeTarget(l)}>
                                        Revoke
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <ConfirmDialog
                isOpen={!!revokeTarget}
                onClose={() => setRevokeTarget(null)}
                onConfirm={revoke}
                title="Revoke share link?"
                message="Anyone using this link will immediately lose access."
                confirmText="Revoke Link"
            />
        </div>
    );
};

export default SharedWithMe;
