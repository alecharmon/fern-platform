"use client";

import { t } from "@fern-docs/i18n";
import type { TableOfContentsItem as TableOfContentsItemType } from "@fern-docs/mdx";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "../cn";
import { TableOfContents } from "./TableOfContents";

export interface TableOfContentsMobileProps {
    tableOfContents: TableOfContentsItemType[];
    lang: string;
    className?: string;
}

export function TableOfContentsMobile({ tableOfContents, lang, className }: TableOfContentsMobileProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (tableOfContents.length === 0) {
        return null;
    }

    return (
        <div className={cn("toc-mobile xl:hidden", className)}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "toc-mobile-trigger flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors",
                    "rounded-3/2 border border-border-default bg-card-background shadow-card-grayscale",
                    "hover:bg-(color:--grayscale-a3)",
                    isOpen && "rounded-b-none border-b-0"
                )}
                aria-expanded={isOpen}
            >
                <span className="text-(color:--grayscale-a11)">{t(lang).navigation.onThisPage}</span>
                <ChevronDown
                    className={cn(
                        "size-4 text-(color:--grayscale-a11) transition-transform duration-200",
                        isOpen && "rotate-180"
                    )}
                />
            </button>
            <div
                className={cn(
                    "toc-mobile-content overflow-hidden transition-all duration-200",
                    isOpen ? "max-h-[calc(100dvh-var(--header-height)-6rem)] opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <div className="border-x border-b border-border-default bg-card-background shadow-card-grayscale rounded-b-3/2 px-4 py-2 max-h-[inherit] overflow-y-auto">
                    <TableOfContents tableOfContents={tableOfContents} lang={lang} hideHeading />
                </div>
            </div>
        </div>
    );
}
