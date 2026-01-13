import ExclamationTriangleIcon from "@heroicons/react/24/solid/ExclamationTriangleIcon";
import { cva, type VariantProps } from "class-variance-authority";
import { RocketIcon } from "lucide-react";

import { cn } from "@/utils/utils";

const noteVariants = cva("flex gap-2 rounded-lg border p-2 px-3", {
    variants: {
        variant: {
            warning: "border-[var(--yellow-1100)] bg-yellow-300",
            error: "border-[var(--color-destructive)] bg-red-100/50 dark:bg-red-700/20",
            bold: "border-primary bg-green-200",
            default: "border-border bg-transparent"
        }
    },
    defaultVariants: {
        variant: "warning"
    }
});

const iconVariants = cva("size-5 flex-shrink-0", {
    variants: {
        variant: {
            warning: "text-[var(--yellow-1100)]",
            error: "text-[var(--color-destructive)]",
            bold: "text-primary",
            default: "text-muted-foreground"
        }
    },
    defaultVariants: {
        variant: "warning"
    }
});

const contentVariants = cva("flex-1 self-center text-sm flex flex-wrap items-center justify-between gap-4", {
    variants: {
        variant: {
            warning: "text-[var(--yellow-1100)]",
            error: "text-[var(--color-destructive)]",
            bold: "text-primary",
            default: "text-foreground",
            success: "text-green-600"
        }
    },
    defaultVariants: {
        variant: "default"
    }
});

type NoteVariant = VariantProps<typeof noteVariants>["variant"];

export interface NoteProps {
    variant?: NoteVariant;
    children?: React.ReactNode;
    className?: string;
    icon?: React.ReactNode;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    rightContent?: React.ReactNode;
    iconClassName?: string;
}

export function Note({
    variant = "default",
    children,
    className,
    icon,
    title,
    subtitle,
    rightContent,
    iconClassName
}: NoteProps) {
    const iconWithStyles = icon ? (
        <div className={cn(iconVariants({ variant }), iconClassName)}>{icon}</div>
    ) : variant === "bold" ? (
        <RocketIcon className={iconVariants({ variant })} />
    ) : variant === "error" || variant === "warning" ? (
        <ExclamationTriangleIcon className={iconVariants({ variant })} />
    ) : null;

    return (
        <div
            className={cn(noteVariants({ variant }), subtitle || children ? "items-start" : "items-center", className)}
        >
            {iconWithStyles}
            <div
                className={cn("flex flex-1 flex-wrap items-center justify-between gap-4", contentVariants({ variant }))}
            >
                <div className="flex flex-col">
                    {title && <p className="text-md">{title}</p>}
                    {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
                    {children && <div>{children}</div>}
                </div>
                {rightContent && <div>{rightContent}</div>}
            </div>
        </div>
    );
}
