"use client";

import { useMediaQuery } from "./use-media-query";

/**
 * Hook that returns whether the viewport is considered "mobile" based on a breakpoint.
 * Uses the shared useMediaQuery hook under the hood.
 *
 * @param breakpoint - The pixel width threshold (default: 768, matching Tailwind's md breakpoint)
 * @returns boolean indicating if viewport width is below the breakpoint
 *
 * @example
 * ```tsx
 * const isMobile = useIsMobile(); // uses default 768px
 * const isSmall = useIsMobile(640); // custom breakpoint
 * ```
 */
export function useIsMobile(breakpoint = 768): boolean {
    const matches = useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
    // Return false during SSR/initial render to avoid hydration mismatches
    return matches ?? false;
}
