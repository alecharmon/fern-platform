import { cn } from "@fern-docs/components/cn";
import type React from "react";

export interface FilesProps {
    children: React.ReactNode;
    className?: string;
}

export function Files({ children, className }: FilesProps) {
    return (
        <div className={cn("fern-card rounded-3 overflow-hidden m-mdx not-prose font-mono text-sm", className)}>
            <div className="p-2 space-y-1">{children}</div>
        </div>
    );
}
