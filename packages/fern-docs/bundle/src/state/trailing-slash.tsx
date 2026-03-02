"use client";

import { setTrailingSlashOverride } from "@fern-api/docs-utils";
import { useEffect } from "react";

/**
 * Client-side component that sets the global trailing slash override
 * based on the per-domain edge flag value passed from the server layout.
 *
 * This ensures that all client-side calls to `conformTrailingSlash()`
 * (e.g., in `slugToHref()`, sidebar links, navigation) use the
 * per-domain trailing slash setting rather than the build-time env var.
 */
export function TrailingSlash({ value }: { value: boolean }) {
    useEffect(() => {
        setTrailingSlashOverride(value);
    }, [value]);

    // Also set synchronously on first render so SSR-hydrated links are correct
    setTrailingSlashOverride(value);

    return null;
}
