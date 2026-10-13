import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useDropzone } from "react-dropzone";
import {
    CloudIcon, FolderPlusIcon, UploadIcon, SearchIcon, LayoutGridIcon, ListIcon,
    HardDriveIcon, TrashIcon, Share2Icon, ChevronRightIcon, FileIcon,
    FolderIcon, XIcon, DownloadIcon, ArrowUpRightIcon, SortAscIcon,
    XCircleIcon, CopyIcon,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Dropdown, DropdownItem } from "../components/ui/Dropdown";
import { ItemDropdown } from "../components/ui/ItemDropdown";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { ProgressBar } from "../components/ui/ProgressBar";
import { useAuth, UserButton } from "../context/AuthContext";
import {
    folderApi, fileApi, shareApi, copyShareLink, getFileIcon, formatBytes, SORT_OPTIONS,
} from "../assets/api";

const NAV_ITEMS = [
    { label: "My Drive", to: "/", Icon: HardDriveIcon },
    { label: "Shared Links", to: "/shared", Icon: Share2Icon },
    { label: "Trash", to: "/trash", Icon: TrashIcon },
];

const fmtDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const Drive = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    const folderId = params.id || null; // /f/:id for nested folders

    const { user, updateUser } = useAuth();

    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [isFetching, setIsFetching] = useState(true);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("name_asc");
    const [view, setView] = useState("grid"); // grid | list

    // upload state
    const [uploadProgress, setUploadProgress] = useState(null); // { done, total }
    const [isUploading, setIsUploading] = useState(false);

    // create / rename / move / share modals
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [renameTarget, setRenameTarget] = useState(null); // { type, id, name }
    const [renameValue, setRenameValue] = useState("");
    const [moveTarget, setMoveTarget] = useState(null);
    const [shareTarget, setShareTarget] = useState(null);
    const [shareLink, setShareLink] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [movingFolderId, setMovingFolderId] = useState(null);

    const onDrop = useCallback(async (accepted) => {
        if (accepted.length === 0) return;
        setIsUploading(true);
        setUploadProgress({ done: 0, total: accepted.reduce((a, f) => a + f.size, 0) });
        try {
            const created = await fileApi.upload(
                accepted,
                folderId,
                (done, total) => setUploadProgress({ done, total })
            );
            setFiles((prev) => [...created, ...prev]);
            const added = created.reduce((a, f) => a + Number(f.size || 0), 0);
            updateUser({ storage_used: Number(user?.storage_used || 0) + added });
            toast.success(`${created.length} file${created.length > 1 ? "s" : ""} uploaded`);
        } catch (err) {
            toast.error(err?.response?.data?.error || "Upload failed");
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    }, [folderId, user, updateUser]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

    // Load data
    const load = useCallback(async (opts = {}) => {
        setIsFetching(true);
        try {
            const [fols, fils] = await Promise.all([
                folderApi.list(opts?.parent_id),
                fileApi.list({
                    folder_id: opts?.folder_id ?? null,
                    search: opts?.search ?? search,
                    sort: opts?.sort ?? sort,
                }),
            ]);
            setFolders(fols);
            setFiles(fils);
            if (opts?.parent_id) {
                try {
                    const { breadcrumbs: crumbs } = await folderApi.get(opts.parent_id);
                    setBreadcrumbs(crumbs);
                    return { breadcrumbs: crumbs };
                } catch {
                    navigate("/", { replace: true });
                }
            } else {
                setBreadcrumbs([]);
            }
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to load drive");
        } finally {
            setIsFetching(false);
        }
    }, [search, sort, navigate]);

    const searchTimer = useRef(null);
    const handleSearchChange = (value) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            fileApi.list({ folder_id: folderId, search: value, sort })
                .then((fils) => setFiles(fils))
                .catch(() => {});
        }, 300);
    };

    useEffect(() => {
        load({ parent_id: folderId ?? null, folder_id: folderId ?? null });
    }, [folderId]);

    const handleCreateFolder = async () => {
        try {
            const folder = await folderApi.create({
                name: newFolderName || "Untitled Folder",
                parent_id: folderId,
            });
            setFolders((prev) => [...prev, folder]);
            setShowNewFolder(false);
            setNewFolderName("");
            toast.success("Folder created");
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to create folder");
        }
    };

    const handleRename = async () => {
        if (!renameTarget) return;
        try {
            if (renameTarget.type === "folder") {
                const folder = await folderApi.rename(renameTarget.id, renameValue);
                setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, ...folder } : f)));
            } else {
                const file = await fileApi.rename(renameTarget.id, renameValue);
                setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, ...file } : f)));
            }
            setRenameTarget(null);
            toast.success("Renamed");
        } catch (err) {
            toast.error(err?.response?.data?.error || "Rename failed");
        }
    };

    const handleMove = async () => {
        if (!moveTarget) return;
        try {
            if (moveTarget.type === "folder") {
                await folderApi.move(moveTarget.id, movingFolderId);
            } else {
                await fileApi.move(moveTarget.id, movingFolderId);
            }
            // refresh listing if anything moved out of the current folder
            const fils = await fileApi.list({ folder_id: folderId ?? null, search, sort });
            const fols = await folderApi.list(folderId);
            setFiles(fils);
            setFolders(fols);
            setMoveTarget(null);
            toast.success("Moved");
        } catch (err) {
            toast.error(err?.response?.data?.error || "Move failed");
        }
    };

    const handleShare = async (target) => {
        setShareTarget(target);
        setIsSharing(true);
        setShareLink(null);
        try {
            const share = await shareApi.create({
                resource_id: target.id,
                resource_type: target.type,
                permission: "download",
            });
            setShareLink(share);
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to create share link");
            setShareTarget(null);
        } finally {
            setIsSharing(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            if (deleteTarget.type === "folder") await folderApi.trash(deleteTarget.id);
            else await fileApi.trash(deleteTarget.id);
            setFolders((prev) => prev.filter((f) => f.id !== deleteTarget.id));
            setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
            toast.success("Moved to trash");
        } catch (err) {
            toast.error(err?.response?.data?.error || "Delete failed");
        } finally {
            setDeleteTarget(null);
        }
    };

    const openPreview = async (file) => {
        setPreviewItem(file);
        setPreviewUrl(null);
        try {
            const url = await fileApi.preview(file.id);
            setPreviewUrl(url);
        } catch {
            toast.error("Preview unavailable");
            setPreviewItem(null);
        }
    };

    const folderTreeOptions = useMemo(() => {
        return folders.filter((f) => f.id !== moveTarget?.id);
    }, [folders, moveTarget]);

    const storagePct = useMemo(() => {
        const used = Number(user?.storage_used || 0);
        const cap = Number(user?.storage_limit || 1);
        return Math.min(100, Math.round((used / cap) * 100));
    }, [user]);

    const hasItems = folders.length > 0 || files.length > 0;

    /* ------------------------------ Layout ------------------------------ */

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row">
            {/* Sidebar - desktop persistent; mobile collapsed to bottom bar */}
            <aside className="w-full shrink-0 md:w-64 md:shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-white md:bg-transparent p-4 md:p-4">
                <div className="flex items-center gap-2 px-2 py-1 mb-4 md:mb-6">
                    <img className="max-h-8" src="/logo.svg" alt="Drivea" />
                    <span className="text-xl font-semibold tracking-tight">Drivea</span>
                </div>

                {/* Mobile-only quick upload + new folder buttons (desktop keeps sidebar buttons) */}
                <div className="flex gap-2 mb-3 md:hidden">
                    <input id="drive-upload-input-mobile" type="file" multiple hidden />
                    <Button
                        icon={UploadIcon}
                        onClick={() => document.getElementById("drive-upload-input-mobile")?.click()}
                        size="sm"
                        className="flex-1 h-9 text-xs"
                    >
                        Upload file
                    </Button>
                    <Button
                        variant="secondary"
                        icon={FolderPlusIcon}
                        onClick={() => setShowNewFolder(true)}
                        size="sm"
                        className="flex-1 h-9 text-xs"
                    >
                        New folder
                    </Button>
                </div>

                {/* Desktop sidebar nav */}
                <nav className="hidden md:flex space-y-1 mb-4">
                    {NAV_ITEMS.map(({ label, to, Icon }) => {
                        const active = to === "/" ? location.pathname === "/" || location.pathname.startsWith("/f/") : location.pathname === to;
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                                    active
                                        ? "bg-orange-600/10 text-orange-700 font-medium"
                                        : "text-slate-600 hover:bg-slate-100"
                                }`}
                            >
                                <Icon className="size-4.5" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Desktop-only buttons in sidebar */}
                <div className="hidden md:flex md:space-y-2 mb-6">
                    <Button
                        icon={UploadIcon}
                        onClick={() => document.getElementById("drive-upload-input")?.click()}
                        className="w-full mb-2"
                    >
                        Upload file
                    </Button>
                    <Button
                        variant="secondary"
                        icon={FolderPlusIcon}
                        onClick={() => setShowNewFolder(true)}
                        className="w-full"
                    >
                        New folder
                    </Button>
                </div>

                {/* Desktop storage card + user row (transparent on mobile since main bg is visible) */}
                <div className="hidden md:block mt-auto">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                            <HardDriveIcon className="size-4 text-slate-500" /> Storage
                        </div>
                        <ProgressBar progress={storagePct} color={storagePct > 90 ? "bg-red-500" : "bg-orange-600"} />
                        <p className="text-xs text-slate-500 mt-2">
                            {formatBytes(user?.storage_used || 0)} of {formatBytes(user?.storage_limit || 0)} used
                        </p>
                    </div>
                    <div className="flex items-center justify-between px-1 mt-4">
                        <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{user?.name || "User"}</p>
                            <p className="text-[10px] text-slate-400 truncate">{user?.email || ""}</p>
                        </div>
                        <UserButton afterSignOutUrl="/login" />
                    </div>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 min-w-0 flex flex-col" {...getRootProps()}>
                {/* Top bar */}
                <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur border-b border-slate-200 px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3">
                    <img className="max-h-7 md:max-h-8" src="/logo.svg" alt="Drivea" />

                    <div className="relative flex-1 max-w-sm md:max-w-md">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        <input
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Search your files…"
                            className="w-full bg-white border border-slate-200 rounded-xl text-sm pl-9 pr-9 py-2 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder-slate-400"
                        />
                        {search && (
                            <button
                                onClick={() => handleSearchChange("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600"
                            >
                                <XCircleIcon className="size-4" />
                            </button>
                        )}
                    </div>

                    <div className="ml-auto flex items-center gap-1">
                        {/* Sort: show label on all sizes, dropdown always available */}
                        <Dropdown
                            trigger={
                                <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="Sort">
                                    <SortAscIcon className="size-4" />
                                </button>
                            }
                        >
                            {SORT_OPTIONS.map((opt) => (
                                <DropdownItem key={opt.value} onClick={() => fileApi.list({ folder_id: folderId ?? null, search, sort: opt.value }).then((fils) => setFiles(fils))}>
                                    {opt.label}
                                </DropdownItem>
                            ))}
                        </Dropdown>

                        {/* View toggle: always visible, touch-friendly */}
                        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
                            {[
                                ["grid", LayoutGridIcon],
                                ["list", ListIcon],
                            ].map(([v, Icon]) => (
                                <button
                                    key={v}
                                    onClick={() => setView(v)}
                                    className={`p-1.5 rounded-lg transition ${
                                        view === v ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-700"
                                    }`}
                                    title={v === "grid" ? "Grid view" : "List view"}
                                >
                                    <Icon className="size-4" />
                                </button>
                            ))}
                        </div>

                        {/* Upload button: always visible as a small button on top bar */}
                        <input id="drive-upload-input" type="file" multiple hidden {...getInputProps()} />
                        <Button
                            icon={UploadIcon}
                            onClick={() => document.getElementById("drive-upload-input")?.click()}
                            size="sm"
                        >
                            Upload
                        </Button>
                    </div>
                </div>

                {/* Breadcrumbs */}
                <div className="px-3 sm:px-4 pt-4 pb-3 flex items-center gap-1 text-xs sm:text-sm flex-wrap">
                    <Link to="/" className="font-medium text-slate-700 hover:text-orange-700 flex items-center gap-1.5">
                        My Drive
                    </Link>
                    {breadcrumbs.map((b) => (
                        <React.Fragment key={b.id}>
                            <ChevronRightIcon className="size-3 text-slate-300" />
                            <Link to={`/f/${b.id}`} className="text-slate-500 hover:text-orange-700 truncate max-w-[140px] sm:max-w-none" title={b.name}>
                                {b.name}
                            </Link>
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 px-3 sm:px-4 pb-24 md:pb-16">
                    {isFetching ? (
                        <div className="flex items-center justify-center py-24">
                            <Spinner size="lg" />
                        </div>
                    ) : !hasItems ? (
                        isDragActive ? (
                            <div className="rounded-2xl border-2 border-dashed border-orange-400 bg-orange-50/50 p-20 text-center">
                                <UploadIcon className="size-10 text-orange-500 mx-auto mb-3" />
                                <p className="text-sm font-medium text-orange-800">Drop your files here</p>
                            </div>
                        ) : (
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            className={`rounded-2xl border-2 border-dashed p-6 sm:p-10 transition ${
                                isDragActive ? "border-orange-400 bg-orange-50/50" : "border-slate-200 bg-white/60"
                            }`}
                        >
                            <EmptyState
                                title="Nothing here yet"
                                description="Drag & drop files anywhere, or use the buttons above to upload and create folders."
                                action={
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button icon={UploadIcon} onClick={() => document.getElementById("drive-upload-input")?.click()} className="w-full sm:w-auto">
                                            Upload file
                                        </Button>
                                        <Button variant="secondary" icon={FolderPlusIcon} onClick={() => setShowNewFolder(true)} className="w-full sm:w-auto">
                                            New folder
                                        </Button>
                                    </div>
                                }
                            />
                        </div>
                        )
                    ) : (
                        <>
                            {folders.length > 0 && (
                                <>
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Folders</h3>
                                    {view === "grid" ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
                                            {folders.map((f) => (
                                                <div
                                                    key={f.id}
                                                    onClick={() => navigate(`/f/${f.id}`)}
                                                    className="group relative flex items-start gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-sm cursor-pointer transition"
                                                >
                                                    <FolderIcon className="size-7 sm:size-8 shrink-0 text-orange-500 fill-orange-50 mt-0.5" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium truncate" title={f.name}>{f.name}</p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(f.created_at)}</p>
                                                    </div>
                                                    <ItemDropdown
                                                        item={f}
                                                        onShare={(it) => handleShare({ ...it, type: "folder" })}
                                                        onRename={(it) => { setRenameTarget({ type: "folder", id: it.id, name: it.name }); setRenameValue(it.name); }}
                                                        onMove={(it) => setMoveTarget({ type: "folder", id: it.id })}
                                                        onDelete={(it) => setDeleteTarget({ type: "folder", id: it.id, name: it.name })}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden mb-6">
                                            {folders.map((f, i) => (
                                                <div
                                                    key={f.id}
                                                    onClick={() => navigate(`/f/${f.id}`)}
                                                    className={`group relative flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50 cursor-pointer ${i > 0 ? "border-t border-slate-200" : ""}`}
                                                >
                                                    <FolderIcon className="size-5 text-orange-500 shrink-0" />
                                                    <p className="text-sm font-medium truncate flex-1 min-w-0">{f.name}</p>
                                                    <p className="text-xs text-slate-400 w-20 sm:w-24 shrink-0">{fmtDate(f.created_at)}</p>
                                                    <ItemDropdown
                                                        item={f}
                                                        onShare={(it) => handleShare({ ...it, type: "folder" })}
                                                        onRename={(it) => { setRenameTarget({ type: "folder", id: it.id, name: it.name }); setRenameValue(it.name); }}
                                                        onMove={(it) => setMoveTarget({ type: "folder", id: it.id })}
                                                        onDelete={(it) => setDeleteTarget({ type: "folder", id: it.id, name: it.name })}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {files.length > 0 && (
                                <>
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Files</h3>
                                    {view === "grid" ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                            {files.map((f) => (
                                                <div
                                                    key={f.id}
                                                    onClick={() => openPreview(f)}
                                                    className="group relative flex flex-col p-2.5 sm:p-3 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-sm cursor-pointer transition"
                                                >
                                                    <div className="h-20 sm:h-24 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-2.5 relative overflow-hidden">
                                                        {f.mime_type?.startsWith("image/") ? (
                                                            <img
                                                                src={f.blob_url || `/api/files/${f.id}/download`}
                                                                alt={f.name}
                                                                className="absolute inset-0 size-full object-cover"
                                                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                                                            />
                                                        ) : null}
                                                        {!f.mime_type?.startsWith("image/") && getFileIcon(f.mime_type, "size-8 sm:size-9")}
                                                    </div>
                                                    <p className="text-sm font-medium truncate" title={f.name}>{f.name}</p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">{formatBytes(f.size)} · {fmtDate(f.created_at)}</p>
                                                    <div className="absolute right-1 top-1 sm:right-1.5 sm:top-1.5">
                                                        <ItemDropdown
                                                            item={f}
                                                            onPreview={openPreview}
                                                            onShare={(it) => handleShare({ ...it, type: "file" })}
                                                            onRename={(it) => { setRenameTarget({ type: "file", id: it.id, name: it.name }); setRenameValue(it.name); }}
                                                            onMove={(it) => setMoveTarget({ type: "file", id: it.id })}
                                                            onDelete={(it) => setDeleteTarget({ type: "file", id: it.id, name: it.name })}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                                            {files.map((f, i) => (
                                                <div
                                                    key={f.id}
                                                    onClick={() => openPreview(f)}
                                                    className={`group relative flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50 cursor-pointer ${i > 0 ? "border-t border-slate-200" : ""}`}
                                                >
                                                    {getFileIcon(f.mime_type, "size-5 shrink-0")}
                                                    <p className="text-sm font-medium truncate flex-1 min-w-0">{f.name}</p>
                                                    <p className="text-xs text-slate-400 w-16 sm:w-20 shrink-0">{formatBytes(f.size)}</p>
                                                    <p className="text-xs text-slate-400 w-20 sm:w-24 shrink-0 hidden sm:block">{fmtDate(f.created_at)}</p>
                                                    <ItemDropdown
                                                        item={f}
                                                        onPreview={openPreview}
                                                        onShare={(it) => handleShare({ ...it, type: "file" })}
                                                        onRename={(it) => { setRenameTarget({ type: "file", id: it.id, name: it.name }); setRenameValue(it.name); }}
                                                        onMove={(it) => setMoveTarget({ type: "file", id: it.id })}
                                                        onDelete={(it) => setDeleteTarget({ type: "file", id: it.id, name: it.name })}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* Upload overlay - mobile-friendly: fixed to bottom-center, touch-readable */}
                    {isUploading && (
                        <div className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm sm:w-72 bg-white border border-slate-200 rounded-2xl shadow-lg p-4 animate-slide-up">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Uploading…</span>
                                <Spinner size="sm" />
                            </div>
                            <ProgressBar
                                progress={uploadProgress ? (uploadProgress.done / Math.max(1, uploadProgress.total)) * 100 : 0}
                            />
                            {uploadProgress && (
                                <p className="text-[11px] text-slate-400 mt-1.5">
                                    {formatBytes(uploadProgress.done)} / {formatBytes(uploadProgress.total)}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile bottom navigation bar */}
            <nav className="md:hidden flex items-center border-t border-slate-200 bg-white px-2 py-1 gap-1 shrink-0">
                {NAV_ITEMS.map(({ label, to, Icon }) => {
                    const active = to === "/" ? location.pathname === "/" || location.pathname.startsWith("/f/") : location.pathname === to;
                    return (
                        <Link
                            key={to}
                            to={to}
                            className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-xs transition ${
                                active
                                    ? "bg-orange-600/10 text-orange-700 font-medium"
                                    : "text-slate-500 hover:bg-slate-100"
                            }`}
                        >
                            <Icon className="size-4" />
                            {label}
                        </Link>
                    );
                })}
            </nav>

            {/* Mobile floating storage + account button */}
            <div className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-between px-3 py-2 bg-white border-t border-slate-200">
                <div className="flex items-center gap-2 text-xs min-w-0">
                    <HardDriveIcon className="size-3.5 text-slate-500 shrink-0" />
                    <span className="truncate font-medium">{formatBytes(user?.storage_used || 0)} / {formatBytes(user?.storage_limit || 0)}</span>
                </div>
                <UserButton afterSignOutUrl="/login" className="shrink-0" />
            </div>

            {/* ------------------------------ Modals ------------------------------ */}

            <Modal isOpen={showNewFolder} onClose={() => setShowNewFolder(false)} title="Create new folder">
                <div className="space-y-4">
                    <Input
                        autoFocus
                        label="Folder name"
                        placeholder="e.g. Documents"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setShowNewFolder(false)}>Cancel</Button>
                        <Button onClick={handleCreateFolder}>Create</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!renameTarget} onClose={() => setRenameTarget(null)} title={`Rename ${renameTarget?.type || "item"}`}>
                <div className="space-y-4">
                    <Input
                        autoFocus
                        label="New name"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
                        <Button onClick={handleRename}>Save</Button>
                    </div>
                </div>
            </Modal>

            {/* Move modal */}
            <Modal isOpen={!!moveTarget} onClose={() => setMoveTarget(null)} title={`Move "${moveTarget?.type || ""}"`} maxWidth="max-w-sm">
                <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
                    <button
                        onClick={() => setMovingFolderId(null)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${
                            movingFolderId === null ? "bg-orange-600/10 text-orange-700 font-medium" : "hover:bg-slate-100"
                        }`}
                    >
                        <HardDriveIcon className="size-4" /> My Drive (root)
                    </button>
                    {folderTreeOptions.map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setMovingFolderId(f.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${
                                movingFolderId === f.id ? "bg-orange-600/10 text-orange-700 font-medium" : "hover:bg-slate-100"
                            }`}
                        >
                            <FolderIcon className="size-4 text-orange-500" /> {f.name}
                        </button>
                    ))}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="ghost" onClick={() => setMoveTarget(null)}>Cancel</Button>
                    <Button onClick={handleMove}>Move here</Button>
                </div>
            </Modal>

            {/* Share modal */}
            <Modal isOpen={!!shareTarget} onClose={() => setShareTarget(null)} title="Share item">
                {isSharing ? (
                    <div className="flex items-center justify-center py-8"><Spinner /></div>
                ) : shareLink ? (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 truncate">
                                {`${window.location.origin}/s/${shareLink.token}`}
                            </div>
                            <Button icon={CopyIcon} onClick={() => copyShareLink(shareLink.token)}>
                                Copy
                            </Button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <Share2Icon className="size-3.5" /> Anyone with this link can access
                            </span>
                            <span>{shareLink.access_count || 0} views</span>
                        </div>
                        <div className="flex justify-end gap-3 pt-1">
                            <Button variant="ghost" onClick={() => setShareTarget(null)}>Done</Button>
                            <a href={`/s/${shareLink.token}`} target="_blank" rel="noreferrer">
                                <Button variant="secondary" icon={ArrowUpRightIcon}>Open link</Button>
                            </a>
                        </div>
                    </div>
                ) : null}
            </Modal>

            {/* Delete confirm */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Move to trash?"
                message={`"${deleteTarget?.name || ""}" will be moved to trash. You can restore it later.`}
                confirmText="Move to Trash"
            />

            {/* Preview modal */}
            <Modal
                isOpen={!!previewItem}
                onClose={() => setPreviewItem(null)}
                title={previewItem?.name || "Preview"}
                maxWidth="max-w-3xl"
            >
                {!previewUrl ? (
                    <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        {previewItem?.mime_type?.startsWith("image/") && (
                            <img src={previewUrl} alt={previewItem.name} className="max-h-[60vh] rounded-xl" />
                        )}
                        {previewItem?.mime_type?.startsWith("video/") && (
                            <video src={previewUrl} controls className="max-h-[60vh] w-full rounded-xl" />
                        )}
                        {previewItem?.mime_type?.startsWith("audio/") && (
                            <audio src={previewUrl} controls className="w-full mt-4" />
                        )}
                        {previewItem?.mime_type === "application/pdf" && (
                            <iframe src={previewUrl} className="w-full h-[60vh] rounded-xl" title={previewItem.name} />
                        )}
                        {!previewItem?.mime_type?.match(/^(image|video|audio\/)|^application\/pdf/) && (
                            <div className="py-10 text-center flex flex-col items-center gap-3">
                                {getFileIcon(previewItem?.mime_type, "size-12")}
                                <p className="text-sm text-slate-500">No inline preview for this file type.</p>
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-slate-400">{formatBytes(previewItem?.size || 0)}</span>
                            <a href={previewUrl} download={previewItem?.name}>
                                <Button variant="secondary" icon={DownloadIcon}>Download</Button>
                            </a>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Drive;
