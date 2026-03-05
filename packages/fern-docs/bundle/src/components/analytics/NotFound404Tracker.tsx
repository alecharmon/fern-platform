"use client";

import { useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { capturePosthogEventCustomer, capturePosthogEventInternal } from "./posthog";
import { track, trackInternal } from "./track";

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

        console.error(`[NotFound404Tracker] Capturing 404 event with properties: ${JSON.stringify(properties)}`);

        // Track 404 to Sentry as a warning (not an exception)
        Sentry.captureMessage(`404 Not Found: ${pathname}`, {
            level: "warning",
            tags: {
                type: "not_found",
                pathname
            },
            contexts: {
                notFoundInfo: {
                    pathname,
                    url: properties.url
                }
            }
        });

        capturePosthogEventInternal("not_found", properties);
        capturePosthogEventCustomer("not_found", properties);
        track("not_found", properties);
        trackInternal("not_found", properties);
    }, [pathname]);

    // This component doesn't render anything
    return null;
}
