"use client";

import * as React from "react";

/**
 * Hook that subscribes to a CSS media query and returns whether it matches.
 * Uses a shared MediaQueryList listener pattern to avoid duplicate event subscriptions.
 *
 * @param query - The CSS media query string (e.g., "(max-width: 768px)")
 * @returns boolean indicating if the media query matches (undefined during SSR/initial render)
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery("(max-width: 767px)");
 * const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
 * ```
 */
export function useMediaQuery(query: string): boolean | undefined {
    const [matches, setMatches] = React.useState<boolean | undefined>(undefined);

    React.useEffect(() => {
        const mql = window.matchMedia(query);

        const onChange = (e: MediaQueryListEvent) => {
            setMatches(e.matches);
        };

        // Set initial value
        setMatches(mql.matches);

        // Add listener with fallback for older browsers
        if (typeof mql.addEventListener === "function") {
            mql.addEventListener("change", onChange);
            return () => {
                mql.removeEventListener("change", onChange);
            };
        } else if (typeof (mql as any).addListener === "function") {
            // Legacy Safari < 14 fallback
            (mql as any).addListener(onChange);
            return () => (mql as any).removeListener(onChange);
        }

        return undefined;
    }, [query]);

    return matches;
}

// Common breakpoint queries matching Tailwind defaults
export const MEDIA_QUERIES = {
    /** Mobile: max-width 767px (below md breakpoint) */
    mobile: "(max-width: 767px)",
    /** Tablet and below: max-width 1023px (below lg breakpoint) */
    tabletAndBelow: "(max-width: 1023px)",
    /** Desktop: min-width 1024px (lg breakpoint and above) */
    desktop: "(min-width: 1024px)",
    /** Prefers reduced motion */
    reducedMotion: "(prefers-reduced-motion: reduce)",
    /** Prefers dark color scheme */
    darkMode: "(prefers-color-scheme: dark)"
} as const;
