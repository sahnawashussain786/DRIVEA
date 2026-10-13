import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertCircleIcon, CloudIcon, DownloadIcon, FolderIcon, UserIcon } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { shareApi, getFileIcon, formatBytes } from "../assets/api";

const SharedFile = () => {
    const { token } = useParams();
    const [data, setData] = useState(null); // { resource_type, file/folder/files, owner, permission }
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (cancelled) return;
                const result = await shareApi.access(token);
                if (cancelled) return;
                // normalize keys for snake_case payloads
                setData({
                    resource_type: result.resource_type || result.resourceType,
                    file: result.file,
                    folder: result.folder,
                    files: result.files,
                    url: result.url || result.preview_url,
                    owner: result.owner,
                    permission: result.permission,
                });
            } catch (err) {
                if (!cancelled) setError(err?.response?.data?.error || "This shared link is not available.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [token]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center max-w-sm bg-white border border-slate-200 rounded-2xl p-8 rounded-2xl">
                    <div className="size-12 mx-auto rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                        <AlertCircleIcon className="size-6" />
                    </div>
                    <h1 className="text-lg font-semibold mb-1">Link unavailable</h1>
                    <p className="text-sm text-slate-500 mb-6">{error}</p>
                    <Link to="/">
                        <Button variant="secondary">Go to Drivea</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const isFolder = data.resource_type === "folder";
    const ownerName = data.owner?.name || "Unknown";

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
            {/* Top bar */}
            <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center gap-3">
                <Link to="/" className="flex items-center gap-2">
                    <img className="max-h-8" src="/logo.svg" alt="Drivea" />
                    <span className="text-lg font-semibold tracking-tight">Drivea</span>
                </Link>
                <span className="ml-auto text-xs text-slate-400 flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5">
                    <UserIcon className="size-3.5" /> Shared by {ownerName}
                </span>
            </header>

            {/* Content */}
            <main className="flex-1 flex items-start justify-center p-6 sm:p-12">
                <div className="w-full max-w-2xl">
                    {isFolder ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-12 rounded-2xl bg-orange-600/10 flex items-center justify-center">
                                    <FolderIcon className="size-6 text-orange-500" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-semibold tracking-tight">{data.folder?.name}</h1>
                                    <p className="text-xs text-slate-400">{data.files?.length || 0} files in this shared folder</p>
                                </div>
                            </div>
                            {data.files?.length ? (
                                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                                    {data.files.map((f, i) => (
                                        <a
                                            key={f.id}
                                            href={f.url || f.blob_url || `/api/files/${f.id}/download`}
                                            download={f.name}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${i > 0 ? "border-t border-slate-100" : ""}`}
                                        >
                                            {f.mime_type?.startsWith("image/") ? (
                                                <img src={f.url || f.blob_url} alt={f.name} className="size-8 rounded object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                                            ) : (
                                                getFileIcon(f.mime_type, "size-5")
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{f.name}</p>
                                                <p className="text-[11px] text-slate-400">{formatBytes(f.size)}</p>
                                            </div>
                                            <Button size="sm" variant="secondary" icon={DownloadIcon}>Download</Button>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState icon={FolderIcon} title="Folder is empty" description="The owner has no files in this shared folder yet." />
                            )}
                        </div>
                    ) : data.file ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col items-center">
                            <div className="w-full h-64 sm:h-96 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center relative overflow-hidden mb-5">
                                {data.file.mime_type?.startsWith("image/") ? (
                                    <img src={data.url} alt={data.file.name} className="absolute inset-0 size-full object-contain" />
                                ) : data.file.mime_type?.startsWith("video/") ? (
                                    <video src={data.url} controls className="absolute inset-0 size-full" />
                                ) : data.file.mime_type?.startsWith("audio/") ? (
                                    <audio src={data.url} controls className="w-4/5" />
                                ) : data.file.mime_type === "application/pdf" ? (
                                    <iframe src={data.url} className="absolute inset-0 size-full" title={data.file.name} />
                                ) : (
                                    getFileIcon(data.file.mime_type, "size-16")
                                )}
                            </div>
                            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-center truncate max-w-full">{data.file.name}</h1>
                            <p className="text-xs text-slate-400 mb-5">{formatBytes(data.file.size)}</p>
                            <a href={data.url} download={data.file.name} target="_blank" rel="noreferrer">
                                <Button icon={DownloadIcon}>Download file</Button>
                            </a>
                        </div>
                    ) : (
                        <EmptyState icon={CloudIcon} title="Nothing to show" description="This shared item no longer exists." />
                    )}
                </div>
            </main>

            <footer className="py-6 text-center text-xs text-slate-400">
                Powered by <Link to="/" className="text-orange-600 hover:text-orange-700 font-medium">Drivea</Link>
            </footer>
        </div>
    );
};

export default SharedFile;
