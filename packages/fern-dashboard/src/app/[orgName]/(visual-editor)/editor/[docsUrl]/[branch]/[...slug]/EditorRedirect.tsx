"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Client-side component that performs a single redirect.
 * Used to work around Next.js parallel routes race conditions on initial page load.
 */
export function EditorRedirect({ redirectUrl }: { redirectUrl: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const lastRedirectUrl = useRef<string | null>(null);

    useEffect(() => {
        // Skip if already at target
        if (pathname === redirectUrl) {
            return;
        }

        // Prevent duplicate redirects (e.g., React Strict Mode double-invoke)
        if (lastRedirectUrl.current === redirectUrl) {
            return;
        }

        lastRedirectUrl.current = redirectUrl;
        router.replace(redirectUrl);
    }, [redirectUrl, router, pathname]);

    return null;
}
