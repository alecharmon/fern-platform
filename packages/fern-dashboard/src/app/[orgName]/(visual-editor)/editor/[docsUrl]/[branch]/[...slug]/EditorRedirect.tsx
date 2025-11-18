"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * This component handles client-side redirects in the Fern Editor while working
 * around Next.js parallel routes race conditions.
 *
 * ## Why This Component Exists
 *
 * The editor uses Next.js parallel routes (@sidebar, @logo, @headertabs,
 * @productSelect,
 * @versionSelect, @devPanel) to render multiple route segments simultaneously.
 * When a redirect is needed (e.g., /docs → /docs/welcome), we cannot use
 * server-side redirect() because:
 *
 * 1. **Parallel Routes Race Condition**: Each parallel route segment (page.tsx,
 *    @sidebar/page.tsx, etc.) renders independently on the server. If each
 *    calls redirect(), they can conflict.
 *
 * 2. **Client-Side Coordination Required**: By using a client-side redirect
 *    with a module-level lock, we ensure only ONE redirect happens across all
 *    parallel routes during the same navigation.
 *
 * ## Why Keyed Lock Approach
 *
 * The module-level variable uses a keyed lock format:
 * `${pathname}->${redirectUrl}`
 *
 * **Benefits:**
 * - **Prevents parallel routes race**: Multiple parallel routes trying to
 *   redirect during the same navigation are blocked (same key = same
 *   navigation)
 * - **Allows subsequent navigations**: Different source pathnames create
 *   different keys, so future navigations to the same target still work
 * - **Proper cleanup**: useEffect cleanup function clears the lock on unmount,
 *   preventing stuck redirects
 *
 * **Previous Approach (Target-Only Lock):** The original implementation tracked
 * redirects by target URL only (`attemptedRedirectUrl`). This caused redirects
 * to get stuck during client-side navigation because the lock persisted across
 * navigations without proper cleanup. Users would see blank screens until they
 * refreshed the page (which reloaded the module and reset the lock).
 *
 * ## References
 * - PR #4308: Original introduction of EditorRedirect to fix parallel routes
 *   race condition
 * - PR #4335: Added React strict mode handling
 * - PR #4345: Added module-level lock to coordinate across parallel routes
 * - Previous Bug: The original implementation used a target-only lock
 *   (`attemptedRedirectUrl`) which persisted across navigations without
 *   cleanup, causing stuck redirects during client-side navigation
 * - PR #5234: Fixed stuck redirects with keyed lock approach and proper cleanup
 */

// Module-level variable to track attempted redirects within the same navigation
// while preventing duplicate redirects from multiple parallel route instances
let attemptedRedirectKey: string | null = null;

export function EditorRedirect({ redirectUrl }: { redirectUrl: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const key = `${pathname}->${redirectUrl}`;
    const claimedRef = useRef(false);

    useEffect(() => {
        if (pathname === redirectUrl) {
            if (attemptedRedirectKey === key) {
                attemptedRedirectKey = null;
            }
            claimedRef.current = false;
            return;
        }

        if (attemptedRedirectKey === key) {
            return;
        }

        // Mark this redirect as attempted and claim the lock
        attemptedRedirectKey = key;
        claimedRef.current = true;
        // Use router-level replace to keep the browser history clean
        router.replace(redirectUrl);

        return () => {
            if (claimedRef.current && attemptedRedirectKey === key) {
                attemptedRedirectKey = null;
            }
        };
    }, [key, pathname, redirectUrl, router]);

    return null;
}
