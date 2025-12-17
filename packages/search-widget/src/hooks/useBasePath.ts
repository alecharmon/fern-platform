import { atom, useAtomValue } from "jotai";

/**
 * Simple base path atom for browser environment
 * Can be set by consumer app via setBasePathAtom
 *
 * This replaces the server-side useBasePath from @fern-docs/components
 * to avoid pulling in server dependencies.
 */
export const basePathAtom = atom("");

/**
 * Hook to get the current base path
 * @returns base path string
 */
export function useBasePath(): string {
    return useAtomValue(basePathAtom);
}
