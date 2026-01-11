"use client";

import { cn } from "@fern-docs/components/cn";
import { ChevronRight, Folder as FolderIcon, FolderOpen } from "lucide-react";
import type React from "react";
import { useState } from "react";

export interface FolderProps {
    name: string;
    defaultOpen?: boolean;
    children?: React.ReactNode;
    className?: string;
    href?: string;
    highlighted?: boolean;
    comment?: string;
}

export function Folder({
    name,
    defaultOpen = false,
    children,
    className,
    href,
    highlighted = false,
    comment
}: FolderProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const formattedComment = comment && !comment.trimStart().startsWith("#") ? `# ${comment}` : comment;

    const folderIcon = isOpen ? (
        <FolderOpen className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
    ) : (
        <FolderIcon className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
    );

    return (
        <div className={cn("select-none", className)}>
            <div
                data-state={isOpen ? "open" : "closed"}
                data-highlighted={highlighted || undefined}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "fern-accordion-trigger group w-full text-left flex items-center gap-2 p-1 rounded-3/2 transition-colors cursor-pointer",
                    highlighted ? "bg-(color:--accent-a4)" : "hover:bg-(color:--grayscale-a4) hover:transition-none"
                )}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                    aria-expanded={isOpen}
                    className="w-6 h-6 flex items-center justify-center shrink-0 cursor-pointer"
                >
                    <ChevronRight className="fern-accordion-trigger-arrow" />
                </button>
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="h-5 flex items-center">{folderIcon}</div>
                    <div className="flex flex-wrap gap-2 flex-1 min-w-0 items-baseline">
                        {href ? (
                            <a
                                href={href}
                                onClick={(e) => e.stopPropagation()}
                                className={cn("text-default break-words", "underline")}
                            >
                                {name}
                            </a>
                        ) : (
                            <span className="text-default break-words">{name}</span>
                        )}
                        {formattedComment && (
                            <span className="font-mono text-xs text-(color:--grayscale-a9) break-words">
                                {formattedComment}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {isOpen && children && (
                <div className="relative ml-4 pl-2 space-y-1 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:border-l before:border-border-default">
                    {children}
                </div>
            )}
        </div>
    );
}
