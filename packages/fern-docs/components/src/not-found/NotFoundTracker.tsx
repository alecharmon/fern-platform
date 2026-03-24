"use client";

import { useEffect } from "react";

interface NotFoundTrackerProps {
    onTrack?: (properties: { pathname: string; url: string | undefined }) => void;
}

export function NotFoundTracker({ onTrack }: NotFoundTrackerProps) {
    useEffect(() => {
        const properties = {
            pathname: typeof window !== "undefined" ? window.location.pathname : "/",
            url: typeof window !== "undefined" ? window.location.href : undefined
        };

        onTrack?.(properties);
    }, [onTrack]);

    return null;
}
