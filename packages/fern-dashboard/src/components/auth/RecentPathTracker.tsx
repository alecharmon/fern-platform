"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { updateRecentPath } from "@/app/actions/updateRecentPath";

const DEBOUNCE_MS = 2000;

/**
 * Silently tracks the current dashboard path in Redis (via server action)
 * so the server can redirect returning users directly to their last-visited
 * page, avoiding intermediate page flashes during login.
 */
export function RecentPathTracker() {
    const pathname = usePathname();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!pathname) {
            return;
        }

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            updateRecentPath(pathname);
        }, DEBOUNCE_MS);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [pathname]);

    return null;
}
