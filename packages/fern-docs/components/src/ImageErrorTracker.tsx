"use client";

import { Children, cloneElement, isValidElement, type ReactElement, useCallback, useEffect, useRef } from "react";

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
 * A minimal client component that tracks image load errors via PostHog.
 * This allows FernImage to remain a Server Component while still having error tracking.
 * Uses cloneElement to inject error handling without adding a wrapper element to the DOM.
 */
export function ImageErrorTracker({ src, children }: ImageErrorTrackerProps) {
    const imgRef = useRef<HTMLImageElement | null>(null);

    const handleError = useCallback(() => {
        console.error(`[FernImage] Failed to load image: ${src}`);
        void reportImageError(src, "load_failed");
    }, [src]);

    useEffect(() => {
        const img = imgRef.current;
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

    const child = Children.only(children);

    if (!isValidElement(child)) {
        // If someone ever passes non-element children, just render as-is.
        return <>{children}</>;
    }

    // Preserve existing ref on the child if any
    const existingRef = (child as ReactElement<{ ref?: React.Ref<HTMLImageElement> }>).props.ref;

    return cloneElement(child as ReactElement<{ ref?: React.Ref<HTMLImageElement> }>, {
        ref: (node: HTMLImageElement | null) => {
            imgRef.current = node;
            if (typeof existingRef === "function") {
                existingRef(node);
            } else if (existingRef && typeof existingRef === "object" && "current" in existingRef) {
                (existingRef as React.MutableRefObject<HTMLImageElement | null>).current = node;
            }
        }
    });
}
