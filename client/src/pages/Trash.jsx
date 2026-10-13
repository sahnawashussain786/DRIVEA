import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { HardDriveIcon, TrashIcon, RotateCcwIcon, Trash2Icon, FolderIcon } from "lucide-react";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { trashApi, fileApi, folderApi, getFileIcon, formatBytes } from "../assets/api";
const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const Trash = () => {
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [isFetching, setIsFetching] = useState(true);
    const [confirmEmpty, setConfirmEmpty] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = async () => {
        setIsFetching(true);
        try {
            const data = await trashApi.list();
            setFiles(data.files);
            setFolders(data.folders);
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to load trash");
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const restoreItem = async (type, id) => {
        setBusyId(id);
        try {
            if (type === "folder") await folderApi.restore(id);
            else await fileApi.restore(id);
            if (type === "folder") setFolders((prev) => prev.filter((f) => f.id !== id));
            else setFiles((prev) => prev.filter((f) => f.id !== id));
            toast.success("Restored to My Drive");
        } catch (err) {
            toast.error(err?.response?.data?.error || "Restore failed");
        } finally {
            setBusyId(null);
        }
    };

    const deleteForever = async (type, id) => {
        setBusyId(id);
        try {
            if (type === "folder") await folderApi.deletePermanent(id);
            else await fileApi.deletePermanent(id);
            if (type === "folder") setFolders((prev) => prev.filter((f) => f.id !== id));
            else setFiles((prev) => prev.filter((f) => f.id !== id));
            toast.success("Deleted forever");
        } catch (err) {
            toast.error(err?.response?.data?.error || "Delete failed");
        } finally {
            setBusyId(null);
        }
    };

    const emptyTrash = async () => {
        setConfirmEmpty(false);
        try {
            await trashApi.empty();
            setFiles([]);
            setFolders([]);
            toast.success("Trash emptied");
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to empty trash");
        }
    };

    const isEmpty = files.length === 0 && folders.length === 0;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row">
            {/* Sidebar - hidden on mobile (bottom nav instead), shown on md+ */}
            <aside className="w-full md:w-64 shrink-0 md:flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-white md:bg-transparent p-4">
                <Link to="/" className="flex items-center gap-2 px-2 py-1 mb-4 md:mb-6">
                    <img className="max-h-8" src="/logo.svg" alt="Drivea" />
                    <span className="text-xl font-semibold tracking-tight">Drivea</span>
                </Link>
                <nav className="space-y-1">
                    <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition">
                        <HardDriveIcon className="size-4.5" /> My Drive
                    </Link>
                    <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm bg-red-600/10 text-red-700 font-medium">
                        <TrashIcon className="size-4.5" /> Trash
                    </Link>
                </nav>
            </aside>

            {/* Main */}
            <div className="flex-1 px-3 sm:px-4 py-4 md:px-8 md:py-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Trash</h1>
                        <p className="text-sm text-slate-500">Items here are kept until you delete them permanently.</p>
                    </div>
                    {!isEmpty && (
                        <Button variant="danger" icon={Trash2Icon} onClick={() => setConfirmEmpty(true)} className="w-full sm:w-auto">
                            Empty trash
                        </Button>
                    )}
                </div>

                {isFetching ? (
                    <div className="flex justify-center py-24"><Spinner size="lg" /></div>
                ) : isEmpty ? (
                    <EmptyState
                        icon={TrashIcon}
                        title="Trash is empty"
                        description="Deleted files and folders will show up here before being permanently removed."
                        action={<Link to="/"><Button variant="secondary">Back to My Drive</Button></Link>}
                    />
                ) : (
                    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                        {folders.map((f) => (                                <div key={`f-${f.id}`} className="group flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 hover:bg-slate-50 transition">
                                <FolderIcon className="size-5 text-orange-500 shrink-0" />
                                <p className="text-sm font-medium truncate flex-1 min-w-0">{f.name}</p>
                                <p className="text-xs text-slate-400 w-20 sm:w-44 shrink-0 hidden xs:block">{fmtDate(f.trashed_at)}</p>
                                <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" icon={RotateCcwIcon} onClick={() => restoreItem("folder", f.id)} disabled={busyId === f.id} title="Restore" className="text-xs">
                                        <span className="hidden sm:inline">Restore</span>
                                        <span className="sm:hidden">↺</span>
                                    </Button>
                                    <Button size="sm" variant="ghost" icon={Trash2Icon} onClick={() => deleteForever("folder", f.id)} disabled={busyId === f.id} className="text-red-600 hover:bg-red-50 text-xs">
                                        <span className="hidden sm:inline">Delete</span>
                                        <span className="sm:hidden">🗑</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {files.map((f) => (
                            <div key={f.id} className="group flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition">
                                {getFileIcon(f.mime_type, "size-5 shrink-0")}
                                <p className="text-sm font-medium truncate flex-1 min-w-0">{f.name}</p>
                                <p className="text-xs text-slate-400 w-16 sm:w-24 shrink-0 hidden sm:block">{formatBytes(f.size)}</p>
                                <p className="text-xs text-slate-400 w-20 sm:w-44 shrink-0 hidden sm:block">{fmtDate(f.trashed_at)}</p>
                                <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" icon={RotateCcwIcon} onClick={() => restoreItem("file", f.id)} disabled={busyId === f.id} title="Restore" className="text-xs">
                                        <span className="hidden sm:inline">Restore</span>
                                        <span className="sm:hidden">↺</span>
                                    </Button>
                                    <Button size="sm" variant="ghost" icon={Trash2Icon} onClick={() => deleteForever("file", f.id)} disabled={busyId === f.id} className="text-red-600 hover:bg-red-50 text-xs">
                                        <span className="hidden sm:inline">Delete</span>
                                        <span className="sm:hidden">🗑</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center border-t border-slate-200 bg-white px-2 py-1 gap-1 shrink-0">
                <Link to="/" className="flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 transition">
                    <HardDriveIcon className="size-4" /> My Drive
                </Link>
                <Link to="/trash" className="flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-xs bg-red-600/10 text-red-700 font-medium">
                    <TrashIcon className="size-4" /> Trash
                </Link>
            </nav>

            {/* Spacer so fixed bottom nav doesn't overlap content on mobile */}
            <div className="h-14 md:hidden" />

            <ConfirmDialog
                isOpen={confirmEmpty}
                onClose={() => setConfirmEmpty(false)}
                onConfirm={emptyTrash}
                title="Empty trash?"
                message="All items in trash will be permanently deleted. This cannot be undone."
                confirmText="Empty Trash"
            />
        </div > 
    );
};

export default Trash;
