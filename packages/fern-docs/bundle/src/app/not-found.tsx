"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { capturePosthogEventInternal } from "@/components/analytics/posthog";

import RootPage from "./page";

export default function RootNotFound() {
    useEffect(() => {
        // Track 404 at the root level (no domain matched)
        const properties = {
            pathname: typeof window !== "undefined" ? window.location.pathname : "/",
            url: typeof window !== "undefined" ? window.location.href : undefined
        };

        // Track to Sentry as a warning
        Sentry.captureMessage(`404 Not Found (Root): ${properties.pathname}`, {
            level: "warning",
            tags: {
                type: "not_found_root",
                pathname: properties.pathname
            },
            contexts: {
                notFoundInfo: {
                    pathname: properties.pathname,
                    url: properties.url
                }
            }
        });

        capturePosthogEventInternal("not_found_root", properties);
    }, []);

    return (
        <main>
            <RootPage />
        </main>
    );
}
