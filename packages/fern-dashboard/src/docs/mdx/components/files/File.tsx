"use client";

import { cn } from "@fern-docs/components/cn";
import { FileText } from "lucide-react";

export interface FileProps {
    name: string;
    className?: string;
    href?: string;
    highlighted?: boolean;
    comment?: string;
}

export function File({ name, className, href, highlighted = false, comment }: FileProps) {
    const formattedComment = comment && !comment.trimStart().startsWith("#") ? `# ${comment}` : comment;

    const content = (
        <>
            <div className="w-6 h-6 shrink-0" />
            <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="h-5 flex items-center">
                    <FileText className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
                </div>
                <div className="flex flex-wrap gap-2 flex-1 min-w-0 items-baseline">
                    <span className={cn("text-default break-words", href && "underline")}>{name}</span>
                    {formattedComment && (
                        <span className="font-mono text-xs text-(color:--grayscale-a9) break-words">
                            {formattedComment}
                        </span>
                    )}
                </div>
            </div>
        </>
    );

    const rowClassName = cn(
        "group flex items-center gap-2 p-1 rounded-3/2 transition-colors",
        highlighted ? "bg-(color:--accent-a4)" : "hover:bg-(color:--grayscale-a4) hover:transition-none",
        className
    );

    if (href) {
        return (
            <a href={href} className={cn(rowClassName, "no-underline")} data-highlighted={highlighted || undefined}>
                {content}
            </a>
        );
    }

    return (
        <div className={rowClassName} data-highlighted={highlighted || undefined}>
            {content}
        </div>
    );
}
