"use client";

import { t } from "@fern-docs/i18n";
import type { TableOfContentsItem as TableOfContentsItemType } from "@fern-docs/mdx";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAtomValue } from "jotai";
import { List } from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "../cn";
import { FernScrollArea } from "../FernScrollArea";
import { SCROLL_BODY_ATOM } from "../state/viewport";
import { clearAnchorJustSet, TableOfContents } from "./TableOfContents";

export interface TableOfContentsMobileProps {
    tableOfContents: TableOfContentsItemType[];
    lang: string;
    className?: string;
}

export function TableOfContentsMobile({ tableOfContents, lang, className }: TableOfContentsMobileProps) {
    const [isOpen, setIsOpen] = useState(false);
    const scrollBody = useAtomValue(SCROLL_BODY_ATOM);

    const handleOpenChange = useCallback(
        (open: boolean) => {
            setIsOpen(open);
            if (open) {
                // Hack: clear the anchorJustSet flag and dispatch a scroll event after a short delay
                // to recalculate visible anchors based on current scroll position
                setTimeout(() => {
                    clearAnchorJustSet();
                    // Dispatch scroll event on the correct scroll container
                    const target = scrollBody ?? window;
                    target.dispatchEvent(new Event("scroll"));
                }, 50);
            }
        },
        [scrollBody]
    );

    if (tableOfContents.length === 0) {
        return null;
    }

    return (
        <div className={cn("toc-mobile xl:hidden hidden", className)}>
            <DropdownMenu.Root modal={false} open={isOpen} onOpenChange={handleOpenChange}>
                <DropdownMenu.Trigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "toc-mobile-trigger flex items-center justify-center",
                            "size-9 rounded-3/2 border border-border-default bg-background shadow-card-grayscale",
                            "hover:bg-(color:--grayscale-a3) transition-colors",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        )}
                        aria-label={t(lang).navigation.onThisPage}
                    >
                        <List className="size-5 text-(color:--grayscale-a11)" />
                    </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content
                        sideOffset={8}
                        align="end"
                        className={cn(
                            "toc-mobile-dropdown z-50 min-w-[200px] max-w-[280px]",
                            "rounded-3/2 border border-border-default bg-background shadow-card-grayscale",
                            "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                        )}
                    >
                        <div className="px-3 py-2 border-b border-border-default">
                            <span className="text-sm font-medium text-(color:--grayscale-a11)">
                                {t(lang).navigation.onThisPage}
                            </span>
                        </div>
                        <FernScrollArea
                            rootClassName="max-h-[calc(100dvh-var(--header-height)-8rem)]"
                            className="p-2"
                            scrollbars="vertical"
                        >
                            <TableOfContents
                                tableOfContents={tableOfContents}
                                lang={lang}
                                hideHeading
                                skipInitialScroll
                            />
                        </FernScrollArea>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
        </div>
    );
}
