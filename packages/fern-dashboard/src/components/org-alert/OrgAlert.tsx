import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

const alertVariants = cva("inline-flex items-center gap-3 rounded-xl border p-1.5", {
    variants: {
        variant: {
            warning: "border-[rgba(217,119,6,0.3)] bg-[#fef8ee] dark:border-[rgba(217,119,6,0.4)] dark:bg-[#422006]",
            danger: "border-[rgba(220,38,38,0.3)] bg-[#fef2f2] dark:border-[rgba(220,38,38,0.4)] dark:bg-[#450a0a]"
        }
    },
    defaultVariants: {
        variant: "danger"
    }
});

const iconVariants = cva("size-5 shrink-0", {
    variants: {
        variant: {
            warning: "text-[#d97706] dark:text-[#fbbf24]",
            danger: "text-[#dc2626] dark:text-[#f87171]"
        }
    },
    defaultVariants: {
        variant: "danger"
    }
});

const textVariants = cva("text-xs leading-4 whitespace-nowrap", {
    variants: {
        variant: {
            warning: "text-[#d97706] dark:text-[#fbbf24]",
            danger: "text-[#dc2626] dark:text-[#f87171]"
        }
    },
    defaultVariants: {
        variant: "danger"
    }
});

export interface OrgAlertProps extends VariantProps<typeof alertVariants> {
    message: string;
    actionLabel: string;
    onAction?: () => void;
    loading?: boolean;
    className?: string;
}

export function OrgAlert({ variant = "danger", message, actionLabel, onAction, loading, className }: OrgAlertProps) {
    return (
        <div className={cn(alertVariants({ variant }), className)}>
            <AlertTriangle
                className={cn(iconVariants({ variant }), "stroke-white dark:stroke-[#1a1a1a]")}
                fill="currentColor"
                strokeWidth={1.5}
            />
            <span className={textVariants({ variant })}>{message}</span>
            <Button size="xs" onClick={onAction} variant="dark" loading={loading} className="dark:shadow-none">
                {actionLabel}
            </Button>
        </div>
    );
}
