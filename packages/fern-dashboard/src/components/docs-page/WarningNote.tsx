import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

import { cn } from "@/utils/utils";

type WarningNoteVariant = "warning" | "error";

export function WarningNote({
    variant = "warning",
    children,
    className
}: {
    variant?: WarningNoteVariant;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex items-start gap-2 rounded-md border p-2 px-3",
                variant === "error"
                    ? "border-red-200 bg-red-100/50 text-red-600 dark:border-red-700 dark:bg-red-700/20"
                    : "border-yellow-800 bg-yellow-300 text-yellow-800",
                className
            )}
        >
            <ExclamationTriangleIcon className="size-6 flex-shrink-0" />
            <div className="flex-1 self-center text-sm">{children}</div>
        </div>
    );
}
