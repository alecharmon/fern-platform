type BadgeVariant = "info" | "success" | "warning";

interface BadgeProps {
    children: React.ReactNode;
    variant: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
    info: "bg-blue-400 text-blue-1100",
    success: "bg-green-300 text-green-1100",
    warning: "bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300"
};

export function Badge({ children, variant }: BadgeProps) {
    return (
        <div
            className={`flex shrink-0 items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-light ${variantStyles[variant]}`}
        >
            {children}
        </div>
    );
}
