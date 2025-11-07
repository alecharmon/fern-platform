import ExclamationTriangleIcon from "@heroicons/react/24/solid/ExclamationTriangleIcon";

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
                variant === "warning" && "border-[var(--yellow-1100)] bg-yellow-300",
                variant === "error" && "border-[var(--color-destructive)] bg-red-100/50 dark:bg-red-700/20",
                className
            )}
        >
            <ExclamationTriangleIcon
                className={cn(
                    "size-6 flex-shrink-0",
                    variant === "warning" && "text-[var(--yellow-1100)]",
                    variant === "error" && "text-[var(--color-destructive)]"
                )}
            />
            <div
                className={cn(
                    "flex-1 self-center text-sm",
                    variant === "warning" && "text-[var(--yellow-1100)]",
                    variant === "error" && "text-[var(--color-destructive)]"
                )}
            >
                {children}
            </div>
        </div>
    );
}
