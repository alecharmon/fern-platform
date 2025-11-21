import { cn } from "@fern-docs/components/cn";
import type { ReactNode } from "react";

export interface IndentProps {
    children: ReactNode;
    className?: string;
}

export function Indent({ children, className }: IndentProps) {
    return (
        <div
            className={cn(
                "fern-indent relative ml-4 pl-4 space-y-1 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:border-l before:border-transparent",
                className
            )}
        >
            {children}
        </div>
    );
}
