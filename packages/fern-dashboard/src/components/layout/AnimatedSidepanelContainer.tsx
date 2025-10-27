"use client";

import React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { cn } from "@/utils/utils";

import { useSidepanel } from "./SidepanelContext";

export function AnimatedSidepanelContainer({ children }: { children: React.ReactNode }) {
    const contentRef = React.useRef<HTMLDivElement>(null);
    // Initialize to true to avoid SSR/window access; update on mount
    const [isMobile, setIsMobile] = React.useState<boolean>(true);
    const { content, clear } = useSidepanel();

    const hasContent = content != null;

    React.useLayoutEffect(() => {
        // Align breakpoint with Tailwind's lg (min-width: 1024px) => mobile is < 1024px
        const mql = window.matchMedia("(max-width: 1023px)");
        const onChange = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches);
        };
        // set initial
        setIsMobile(mql.matches);
        // add listener with fallback for older browsers
        if (typeof mql.addEventListener === "function") {
            mql.addEventListener("change", onChange);
            return () => {
                mql.removeEventListener("change", onChange);
            };
        } else if (typeof (mql as any).addListener === "function") {
            (mql as any).addListener(onChange);
            return () => (mql as any).removeListener(onChange);
        }
        // Fallback cleanup: no listener APIs available; keep a benign reference
        return () => {
            // Access to maintain a non-empty cleanup; no side effects
            void mql.matches;
        };
    }, []);

    if (isMobile) {
        const show = hasContent;
        return (
            <>
                {children}
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
                            {content}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Desktop/tablet: resizable panel with slide-in animation
    return (
        <PanelGroup direction="horizontal" className="flex-1">
            <Panel defaultSize={hasContent ? 70 : 100} minSize={30} className="h-full overflow-hidden">
                <div className={cn("flex min-w-0 flex-1 h-full", !hasContent && "md:pr-2")}>{children}</div>
            </Panel>
            <PanelResizeHandle className={cn("group relative w-4 bg-transparent", !hasContent && "hidden")}>
                <div className="absolute inset-y-0 left-1 flex flex-col items-center justify-center">
                    <div
                        className="absolute top-6 bottom-0 w-px transition-colors duration-200"
                        style={{
                            background: "transparent"
                        }}
                    />
                    <div
                        className="absolute top-6 bottom-0 w-px opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-data-[resize-handle-active]:opacity-100"
                        style={{
                            background:
                                "linear-gradient(to bottom, transparent 0%, var(--primary) 64px, var(--primary) 100%)"
                        }}
                    />
                    <div
                        className="relative z-10 h-6 w-2 rounded-full border transition-colors duration-200"
                        style={{
                            background: "var(--sidebar)",
                            borderColor: "var(--gray-500)"
                        }}
                    />
                    <div
                        className="absolute z-10 h-6 w-2 rounded-full border opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-data-[resize-handle-active]:opacity-100"
                        style={{
                            background: "var(--primary)",
                            borderColor: "var(--primary)"
                        }}
                    />
                </div>
            </PanelResizeHandle>
            <Panel
                defaultSize={30}
                minSize={15}
                maxSize={50}
                className={cn("sidepanel-container", hasContent && "pr-2", !hasContent && "hidden")}
                style={{ minWidth: "320px" }}
            >
                <div ref={contentRef} className="h-full">
                    <div className="h-full w-full overflow-y-auto bg-[var(--gray-100)] transition-all duration-500 ease-out md:rounded-t-2xl">
                        {content}
                    </div>
                </div>
            </Panel>
        </PanelGroup>
    );
}
