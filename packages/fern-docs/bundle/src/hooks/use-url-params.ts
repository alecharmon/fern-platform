import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

function getCurrentPathname(fallback: string): string {
    if (typeof window === "undefined") {
        return fallback;
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const locationPathname = window.location.pathname;
    if (basePath && locationPathname.startsWith(basePath)) {
        return locationPathname.slice(basePath.length) || "/";
    }
    return locationPathname;
}

/**
 * This hook is used to add and remove URL params from the current pathname.
 *
 * Uses window.location at call time to avoid stale pathname values
 * that can occur in Next.js parallel route layouts during soft navigation.
 */
export function useUrlParams() {
    const searchParams = useSearchParams();
    const pathname = usePathname();

    /**
     * This function is used to add a URL param to the current pathname.
     * @param key - The key of the URL param to add.
     * @param value - The value of the URL param to add.
     * @returns The new pathname with the URL param added.
     */
    const addUrlParamToPathname = useCallback(
        (key: string, value: string) => {
            const currentPathname = getCurrentPathname(pathname);
            const params =
                typeof window !== "undefined"
                    ? new URLSearchParams(window.location.search)
                    : new URLSearchParams(searchParams);
            params.set(key, value);
            return `${currentPathname}?${params.toString()}`;
        },
        [searchParams, pathname]
    );

    /**
     * This function is used to remove a URL param from the current pathname.
     * @param key - The key of the URL param to remove.
     * @returns The new pathname with the URL param removed.
     */
    const removeUrlParamFromPathname = useCallback(
        (key: string) => {
            const currentPathname = getCurrentPathname(pathname);
            const params =
                typeof window !== "undefined"
                    ? new URLSearchParams(window.location.search)
                    : new URLSearchParams(searchParams);
            params.delete(key);
            const search = params.toString();
            return search ? `${currentPathname}?${search}` : currentPathname;
        },
        [searchParams, pathname]
    );

    /**
     * This function is used to check if a URL param exists in the current pathname.
     * @param key - The key of the URL param to check.
     * @returns True if the URL param exists, false otherwise.
     */
    const urlHasParam = useCallback((key: string) => searchParams.has(key), [searchParams]);

    return {
        addUrlParamToPathname,
        removeUrlParamFromPathname,
        urlHasParam
    };
}
