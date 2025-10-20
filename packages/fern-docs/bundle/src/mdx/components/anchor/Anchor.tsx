"use client";

import { useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import React, { type ReactNode, useRef } from "react";

import { FernAnchor } from "@/components/FernAnchor";

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

    const anchorId = id.startsWith("#") ? id.slice(1) : id;
    const fullHref = `${pathname}#${anchorId}`;

    const handleClick = (e: React.MouseEvent) => {
        if (elementRef.current) {
            e.preventDefault();
            elementRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            window.history.pushState(null, "", fullHref);
        }
    };

    return (
        <FernAnchor href={fullHref} asChild>
            <span id={anchorId} ref={elementRef} onClick={handleClick}>
                {children}
            </span>
        </FernAnchor>
    );
}
