"use client";

import { useEffect, useState } from "react";

/**
 * Hook that detects if the custom footer element (#fern-footer) has content injected.
 * Uses MutationObserver to watch for content being added/removed.
 *
 * @returns true if #fern-footer has children (custom footer content), false otherwise
 */
export function useHasCustomFooter(): boolean {
    const [hasContent, setHasContent] = useState(false);

    useEffect(() => {
        const footerElement = document.getElementById("fern-footer");
        if (!footerElement) {
            return;
        }

        const checkContent = (): void => {
            setHasContent(footerElement.childNodes.length > 0);
        };

        // Check initial state
        checkContent();

        // Watch for content changes
        const observer = new MutationObserver(checkContent);
        observer.observe(footerElement, {
            childList: true,
            subtree: false
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    return hasContent;
}
