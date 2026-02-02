"use client";

import React from "react";

import { MEDIA_QUERIES, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/utils/utils";

import { useSidepanel } from "./SidepanelContext";

export function AnimatedSidepanelContainer({ children }: { children: React.ReactNode }) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [hasContent, setHasContent] = React.useState(false);
    // Use shared media query hook for tablet/mobile detection (max-width: 1023px)
    const isMobileFromQuery = useMediaQuery(MEDIA_QUERIES.tabletAndBelow);
    // Default to true during SSR to match original behavior
    const isMobile = isMobileFromQuery ?? true;
    const { clear, content } = useSidepanel();
    const hasContextContent = content != null;

    const checkHasContent = React.useCallback(() => {
        const node = contentRef.current;
        if (!node) {
            setHasContent(false);
            return;
        }
        const directChild = node.children.item(0) as HTMLElement | null;
        if (!directChild) {
            setHasContent(false);
            return;
        }
        const directHasElements = directChild.childElementCount > 0;
        const directHasNonEmptyText = (directChild.textContent || "").trim().length > 0;
        setHasContent(directHasElements || directHasNonEmptyText);
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: run when children changes or breakpoint changes
    React.useLayoutEffect(() => {
        // Ensure we re-check content whenever children or layout (mobile/desktop) might change
        checkHasContent();
    }, [checkHasContent, children, isMobile]);

    React.useEffect(() => {
        // Attach observers to the current content node; reattach when layout switches
        const node = contentRef.current;
        if (!node) {
            return;
        }
        const resizeObserver = new ResizeObserver(() => {
            checkHasContent();
        });
        const mutationObserver = new MutationObserver(() => {
            checkHasContent();
        });
        resizeObserver.observe(node);
        mutationObserver.observe(node, {
            childList: true,
            subtree: true,
            characterData: true
        });
        return () => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, [checkHasContent]);

    if (isMobile) {
        const show = hasContextContent || hasContent;
        return (
            <>
                <div
                    aria-hidden
                    className={cn(
                        "fixed inset-0 z-[80] bg-black/10 backdrop-blur-sm transition-opacity duration-200",
                        show ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                    )}
                    onClick={() => {
                        clear();
                    }}
                />
                <div
                    role="dialog"
                    aria-modal="true"
                    className={cn(
                        "fixed inset-x-0 bottom-0 z-[90] origin-bottom rounded-t-2xl bg-[var(--gray-100)] shadow-2xl transition-transform duration-300 ease-out",
                        "max-h-[80vh] w-full",
                        show ? "translate-y-0" : "translate-y-full"
                    )}
                >
                    <div className="h-full max-h-[calc(80vh-0.5rem)] overflow-y-auto p-4">
                        <div ref={contentRef} className="w-full">
                            {children}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Desktop/tablet: slide-out container with width transition
    const show = hasContextContent || hasContent;
    return (
        <div
            ref={containerRef}
            className={cn("sidepanel-container overflow-hidden transition-[width] duration-300", show && "pr-2")}
            style={{ width: show ? "var(--sidepanel-max-width, 32rem)" : 0 }}
        >
            <div ref={contentRef} className="h-full w-full">
                {children}
            </div>
        </div>
    );
}
