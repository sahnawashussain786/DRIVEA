import { FileTextIcon, ImageIcon, FilmIcon, MusicIcon, FileArchiveIcon, FileSpreadsheetIcon, FileCodeIcon, FileIcon } from "lucide-react";
import { toast } from "react-hot-toast";

// Sorting options for files
export const SORT_OPTIONS = [
    { label: "Name (A-Z)", value: "name_asc" },
    { label: "Name (Z-A)", value: "name_desc" },
    { label: "Date (Newest first)", value: "date_desc" },
    { label: "Date (Oldest first)", value: "date_asc" },
    { label: "Size (Largest first)", value: "size_desc" },
    { label: "Size (Smallest first)", value: "size_asc" },
];

// Format bytes into human readable string (e.g. 1.25 MB)
export function formatBytes(bytes, decimals = 2) {
    const num = Number(bytes);
    if (!num || num === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return parseFloat((num / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Icon mapping configuration
const ICON_RULES = [
    { test: (m) => m.startsWith("image/"), Icon: ImageIcon, color: "text-emerald-500" },
    { test: (m) => m.startsWith("video/"), Icon: FilmIcon, color: "text-purple-500" },
    { test: (m) => m.startsWith("audio/"), Icon: MusicIcon, color: "text-pink-500" },
    { test: (m) => m === "application/pdf", Icon: FileTextIcon, color: "text-red-500" },
    { test: (m) => /(zip|tar|rar|compressed)/i.test(m), Icon: FileArchiveIcon, color: "text-amber-500" },
    { test: (m) => /(excel|spreadsheet|csv)/i.test(m), Icon: FileSpreadsheetIcon, color: "text-emerald-500" },
    { test: (m) => /(json|javascript|html|css|xml)/i.test(m), Icon: FileCodeIcon, color: "text-cyan-500" },
];

// Returns matching Lucide Icon component based on MIME type
export function getFileIcon(mime_type, className = "size-6") {
    if (!mime_type) return <FileIcon className={`${className} text-orange-500`} />;
    const match = ICON_RULES.find((r) => r.test(mime_type));
    const Icon = match ? match.Icon : FileIcon;
    const color = match ? match.color : "text-orange-500";
    return <Icon className={`${className} ${color}`} />;
}

// Helper to copy share link to clipboard
export const copyShareLink = (token) => {
    const url = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
    return url;
};


