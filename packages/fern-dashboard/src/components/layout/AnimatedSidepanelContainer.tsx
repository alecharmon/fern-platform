"use client";

import React from "react";

import { cn } from "@/utils/utils";

import { useSidepanel } from "./SidepanelContext";

export function AnimatedSidepanelContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [hasContent, setHasContent] = React.useState(false);
  // Initialize to true to avoid SSR/window access; update on mount
  const [isMobile, setIsMobile] = React.useState<boolean>(true);
  const { clear } = useSidepanel();

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
    const directHasNonEmptyText =
      (directChild.textContent || "").trim().length > 0;
    setHasContent(directHasElements || directHasNonEmptyText);
  }, []);

  React.useLayoutEffect(() => {
    // Ensure we re-check content whenever children or layout (mobile/desktop) might change
    checkHasContent();
  }, [checkHasContent, children]);

  React.useEffect(() => {
    // Attach observers to the current content node; reattach when layout switches
    const node = contentRef.current;
    if (!node) return;
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
      characterData: true,
    });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [checkHasContent, isMobile]);

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

  React.useLayoutEffect(() => {
    // Re-evaluate content presence when breakpoint changes
    checkHasContent();
  }, [checkHasContent, isMobile]);

  if (isMobile) {
    const show = hasContent;
    return (
      <>
        <div
          aria-hidden
          className={cn(
            "fixed inset-0 z-[80] bg-black/10 backdrop-blur-sm transition-opacity duration-200",
            show
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
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
  return (
    <div
      ref={containerRef}
      className={cn(
        "sidepanel-container overflow-hidden transition-[width] duration-300",
        hasContent && "pr-2"
      )}
      style={{ width: hasContent ? "var(--sidepanel-max-width, 32rem)" : 0 }}
    >
      <div ref={contentRef} className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
