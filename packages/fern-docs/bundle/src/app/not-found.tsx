"use client";

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
        capturePosthogEventInternal("not_found_root", properties);
    }, []);

    return (
        <main>
            <RootPage />
        </main>
    );
}
