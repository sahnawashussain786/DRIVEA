import { FolderOpenIcon } from "lucide-react";

export function EmptyState({
    title = "No items found",
    description = "Drag & drop files here or click New to get started.",
    icon: Icon = FolderOpenIcon,
    action,
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-3 text-center">
            <div className="size-14 sm:size-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 sm:mb-4 text-slate-500">
                <Icon className="size-7 sm:size-8" />
            </div>
            <h3 className="text-base font-medium text-slate-900 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 max-w-sm mb-5">{description}</p>
            {action && <div>{action}</div>}
        </div>
    );
}
