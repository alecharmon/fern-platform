"use client";

import { useEffect } from "react";

import { useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";

import { capturePosthogEventCustomer, capturePosthogEventInternal } from "./posthog";

/**
 * Component to track 404 errors with PostHog.
 * Should be added to not-found pages to capture analytics when users hit a 404.
 */
export function NotFound404Tracker() {
    const pathname = useCurrentPathname();

    useEffect(() => {
        // Capture the 404 event with the pathname that wasn't found
        const properties = {
            pathname,
            url: typeof window !== "undefined" ? window.location.href : undefined
        };

        capturePosthogEventInternal("not_found", properties);
        capturePosthogEventCustomer("not_found", properties);
    }, [pathname]);

    // This component doesn't render anything
    return null;
}
