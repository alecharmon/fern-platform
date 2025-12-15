"use client";

import { cn } from "@fern-docs/components/cn";
import { FernAnchor } from "@fern-docs/components/FernAnchor";
import { useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import React, { type ReactNode, useEffect, useRef, useState } from "react";

function useCurrentHash() {
    const [hash, setHash] = useState("");

    useEffect(() => {
        const updateHash = () => setHash(window.location.hash);

        // Listen to hash changes
        window.addEventListener("hashchange", updateHash);

        // Poll as fallback for cases where hashchange doesn't fire (e.g., programmatic changes)
        const interval = setInterval(updateHash, 100);

        return () => {
            window.removeEventListener("hashchange", updateHash);
            clearInterval(interval);
        };
    }, []);

    return hash;
}

interface AnchorProps {
    /**
     * The anchor ID for the element (e.g., "data" creates "#data")
     */
    id: string;
    children: ReactNode;
}

/**
 * Anchor component that wraps content and generates a stable anchor link
 *
 * Example:
 * ```jsx
 * <Anchor id="data">
 *   and the data would be
 * </Anchor>
 * ```
 * This will render the text with a linkable anchor at `{current-page-url}#data`
 * and scroll to center the element when the anchor link is clicked.
 */
export function Anchor({ id, children }: AnchorProps) {
    const pathname = useCurrentPathname();
    const elementRef = useRef<HTMLSpanElement>(null);
    const currentHash = useCurrentHash();

    const anchorId = id.startsWith("#") ? id.slice(1) : id;
    const fullHref = `${pathname}#${anchorId}`;
    const isActive = currentHash === `#${anchorId}`;

    const handleClick = (e: React.MouseEvent) => {
        if (elementRef.current) {
            e.preventDefault();
            elementRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            window.history.pushState(null, "", fullHref);
        }
    };

    return (
        <FernAnchor href={fullHref} asChild>
            <span
                onClick={handleClick}
                id={anchorId}
                ref={elementRef}
                className={cn(isActive && "ring-2 ring-(color:--accent) rounded-3/2 block px-0.5")}
            >
                {children}
            </span>
        </FernAnchor>
    );
}
