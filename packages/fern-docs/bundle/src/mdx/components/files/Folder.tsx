import { cn } from "@fern-docs/components/cn";
import { ChevronRight, Folder as FolderIcon, FolderOpen } from "lucide-react";
import type React from "react";
import { useState } from "react";

export interface FolderProps {
    name: string;
    defaultOpen?: boolean;
    children?: React.ReactNode;
    className?: string;
}

export function Folder({ name, defaultOpen = false, children, className }: FolderProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={cn("select-none", className)}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                data-state={isOpen ? "open" : "closed"}
                aria-expanded={isOpen}
                className={cn(
                    "fern-accordion-trigger w-full text-left flex items-center gap-2 p-1 rounded-3/2 cursor-pointer transition-colors hover:bg-(color:--grayscale-a4) hover:transition-none"
                )}
            >
                <ChevronRight className="fern-accordion-trigger-arrow" />
                {isOpen ? (
                    <FolderOpen className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
                ) : (
                    <FolderIcon className="size-4 flex-shrink-0 text-(color:--grayscale-a11)" />
                )}
                <span className="text-default">{name}</span>
            </button>
            {isOpen && children && (
                <div className="relative ml-2 pl-2 space-y-1 before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:border-l before:border-border-default">
                    {children}
                </div>
            )}
        </div>
    );
}
