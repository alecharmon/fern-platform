"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Module-level variable to track attempted redirects within the same page load
// This naturally resets on page refresh since the module is reloaded,
// but prevents duplicate redirects from multiple parallel route instances
let attemptedRedirectUrl: string | null = null;

/**
 * Client-side component that performs a single redirect.
 * Used to work around Next.js parallel routes race conditions on initial page load.
 * Uses a module-level variable to ensure redirect only happens once across all parallel
 * route instances during the same page load, while allowing redirects on page refresh.
 */
export function EditorRedirect({ redirectUrl }: { redirectUrl: string }) {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // If we've reached the target, clean up the flag
        if (pathname === redirectUrl) {
            if (attemptedRedirectUrl === redirectUrl) {
                attemptedRedirectUrl = null;
            }
            return;
        }

        // Check if this redirect has already been attempted (across all parallel route instances)
        if (attemptedRedirectUrl === redirectUrl) {
            return;
        }

        // Mark this redirect as attempted
        attemptedRedirectUrl = redirectUrl;
        // Use router-level replace to keep the browser history clean
        router.replace(redirectUrl);
    }, [redirectUrl, router, pathname]);

    return null;
}
