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
        console.error(`[FernImage] Failed to load image: ${src}`);
        setHasError(true);
        if (!isAirgapped) {
            void reportImageError(src, "load_failed");
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

        // If the image already failed to load before this effect ran
        if (img.complete && img.naturalWidth === 0) {
            handleError();
            return;
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

    // If the image failed or timed out, show a placeholder.
    if (hasError) {
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
