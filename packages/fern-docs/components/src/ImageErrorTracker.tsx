"use client";

import { useCallback, useEffect, useRef } from "react";

async function reportImageError(src: string, error: string) {
    try {
        await fetch("/api/fern-docs/image-error", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ src, error, url: window.location.href })
        });
    } catch {
        // Silently fail - don't break the page if reporting fails
    }
}

interface ImageErrorTrackerProps {
    src: string;
    children: React.ReactNode;
}

/**
 * A minimal client component that wraps an image and tracks load errors via PostHog.
 * This allows FernImage to remain a Server Component while still having error tracking.
 */
export function ImageErrorTracker({ src, children }: ImageErrorTrackerProps) {
    const containerRef = useRef<HTMLSpanElement>(null);

    const handleError = useCallback(() => {
        console.error(`[FernImage] Failed to load image: ${src}`);
        void reportImageError(src, "load_failed");
    }, [src]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const img = container.querySelector("img");
        if (!img) {
            return;
        }

        // If the image already failed to load before this effect ran
        if (img.complete && img.naturalWidth === 0) {
            handleError();
            return;
        }

        img.addEventListener("error", handleError);
        return () => {
            img.removeEventListener("error", handleError);
        };
    }, [handleError]);

    return <span ref={containerRef}>{children}</span>;
}
