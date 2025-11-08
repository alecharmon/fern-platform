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
}

export function Folder({ name, defaultOpen = false, children, className, href }: FolderProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const folderIcon = isOpen ? (
        <FolderOpen className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
    ) : (
        <FolderIcon className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
    );

    return (
        <div className={cn("select-none", className)}>
            <div
                data-state={isOpen ? "open" : "closed"}
                className={cn(
                    "fern-accordion-trigger group w-full text-left flex items-center gap-2 p-1 rounded-3/2 transition-colors hover:bg-(color:--grayscale-a4) hover:transition-none"
                )}
            >
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                    className="cursor-pointer"
                >
                    <ChevronRight className="fern-accordion-trigger-arrow" />
                </button>
                {folderIcon}
                {href ? (
                    <a href={href} className={cn("text-default", "group-hover:underline")}>
                        {name}
                    </a>
                ) : (
                    <span className="text-default">{name}</span>
                )}
            </div>
            {isOpen && children && (
                <div className="relative ml-2 pl-2 space-y-1 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:border-l before:border-border-default">
                    {children}
                </div>
            )}
        </div>
    );
}
