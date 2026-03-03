"use client";

import { MediaBlockedPlaceholder } from "@fern-docs/components/MediaBlockedPlaceholder";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useIsAirgapped } from "@/state/airgapped";

/**
 * Default timeout in milliseconds before treating a video as failed.
 * Only used in airgapped environments where network requests may hang
 * for a long time before timing out.
 */
const VIDEO_LOAD_TIMEOUT_MS = 15_000;

/**
 * A wrapper around the native <video> element that gracefully handles load failures.
 * When a video fails to load (or times out), it hides the element to prevent
 * media loading failures from blocking page rendering, especially in airgapped
 * environments where network requests may hang for a long time.
 */
export const Video = forwardRef<HTMLVideoElement, React.ComponentPropsWithoutRef<"video">>((props, forwardedRef) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [hasError, setHasError] = useState(false);
    const loadedRef = useRef(false);
    const isAirgapped = useIsAirgapped();

    const handleError = useCallback(() => {
        console.error(`[Video] Failed to load video: ${props.src}`);
        setHasError(true);
    }, [props.src]);

    const handleLoadedData = useCallback(() => {
        loadedRef.current = true;
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !props.src) {
            return;
        }

        loadedRef.current = false;

        // If the video already has data loaded
        if (video.readyState >= 2) {
            loadedRef.current = true;
            return;
        }

        video.addEventListener("error", handleError);
        video.addEventListener("loadeddata", handleLoadedData);

        // Only apply timeout in airgapped environments
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (isAirgapped) {
            timeoutId = setTimeout(() => {
                if (!loadedRef.current) {
                    console.warn(`[Video] Video load timed out after ${VIDEO_LOAD_TIMEOUT_MS}ms: ${props.src}`);
                    setHasError(true);
                }
            }, VIDEO_LOAD_TIMEOUT_MS);
        }

        return () => {
            video.removeEventListener("error", handleError);
            video.removeEventListener("loadeddata", handleLoadedData);
            if (timeoutId != null) {
                clearTimeout(timeoutId);
            }
        };
    }, [props.src, handleError, handleLoadedData, isAirgapped]);

    if (hasError) {
        return <MediaBlockedPlaceholder type="video" />;
    }

    return (
        <video
            ref={(node) => {
                videoRef.current = node;
                if (typeof forwardedRef === "function") {
                    forwardedRef(node);
                } else if (forwardedRef && typeof forwardedRef === "object") {
                    (forwardedRef as React.MutableRefObject<HTMLVideoElement | null>).current = node;
                }
            }}
            {...props}
        />
    );
});

Video.displayName = "Video";
