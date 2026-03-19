"use client";

import {
    Children,
    cloneElement,
    isValidElement,
    type ReactElement,
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
import { MediaBlockedPlaceholder } from "./MediaBlockedPlaceholder";

/**
 * Default timeout in milliseconds before treating an image as failed.
 * Only used in airgapped environments where network requests may hang
 * for a long time before timing out.
 */
const IMAGE_LOAD_TIMEOUT_MS = 10_000;

/**
 * Delay before confirming an image error is real (not a transient/hydration race).
 * After this delay, we recheck naturalWidth to avoid false positives.
 */
const ERROR_CONFIRMATION_DELAY_MS = 2_000;

/** Tracks which srcs have already been reported this page load to avoid duplicates. */
const reportedSrcs = new Set<string>();

async function reportImageError(src: string, error: string) {
    if (reportedSrcs.has(src)) {
        return;
    }
    reportedSrcs.add(src);
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
    /**
     * When true, a timeout is applied to detect images that hang in airgapped
     * environments. Failed/timed-out images show a placeholder.
     */
    isAirgapped?: boolean;
}

/**
 * A client component that tracks image load errors and gracefully handles failures.
 * When isAirgapped is true and an image fails to load (or times out), it shows a
 * placeholder to prevent media loading failures from blocking page rendering.
 */
export function ImageErrorTracker({ src, children, isAirgapped = false }: ImageErrorTrackerProps) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [hasError, setHasError] = useState(false);

    const handleError = useCallback(() => {
        setHasError(true);
        if (!isAirgapped) {
            // Defer reporting: recheck after a delay to filter out transient errors
            // where the image recovers (e.g., browser retry, hydration race).
            const img = imgRef.current;
            setTimeout(() => {
                if (img && img.naturalWidth > 0) {
                    // Image recovered — not a real error
                    return;
                }
                void reportImageError(src, "load_failed");
            }, ERROR_CONFIRMATION_DELAY_MS);
        }
    }, [src, isAirgapped]);

    useEffect(() => {
        const img = imgRef.current;
        if (!img) {
            return;
        }

        // If the image already loaded successfully, nothing to do
        if (img.complete && img.naturalWidth > 0) {
            return;
        }

        // If the image already failed to load before this effect ran,
        // defer the check to avoid hydration race false positives.
        if (img.complete && img.naturalWidth === 0) {
            const recheckId = setTimeout(() => {
                // Recheck: the image may have loaded by now (hydration race)
                if (img.naturalWidth === 0) {
                    handleError();
                }
            }, ERROR_CONFIRMATION_DELAY_MS);
            return () => clearTimeout(recheckId);
        }

        img.addEventListener("error", handleError);

        // Timeout: only in airgapped mode, if the image hasn't loaded within
        // the timeout period, treat it as failed.
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (isAirgapped) {
            timeoutId = setTimeout(() => {
                if (!img.complete) {
                    console.warn(`[FernImage] Image load timed out after ${IMAGE_LOAD_TIMEOUT_MS}ms: ${src}`);
                    setHasError(true);
                }
            }, IMAGE_LOAD_TIMEOUT_MS);
        }

        return () => {
            img.removeEventListener("error", handleError);
            if (timeoutId != null) {
                clearTimeout(timeoutId);
            }
        };
    }, [handleError, src, isAirgapped]);

    // In airgapped environments, show a placeholder when images fail to load.
    // In normal environments, let the browser render its default broken-image indicator.
    if (hasError && isAirgapped) {
        return <MediaBlockedPlaceholder type="image" />;
    }

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
