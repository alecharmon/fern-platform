"use client";

import type { ReactNode } from "react";

interface DropIndicatorProps {
    /** Whether this indicator should be visible */
    visible: boolean;
    /**
     * Vertical offset in pixels.  Positive values push the indicator down,
     * negative values push it up.  Used by section drop zones to render the
     * indicator at the edge-zone boundary instead of flush with the content.
     */
    offsetY?: number;
}

/**
 * A thin horizontal line that indicates where a dragged item will be dropped.
 * Rendered between sidebar items during drag and drop operations.
 */
export function DropIndicator({ visible, offsetY }: DropIndicatorProps): ReactNode {
    if (!visible) {
        return null;
    }

    return (
        <div
            className="pointer-events-none relative z-10 flex h-0 items-center"
            style={offsetY ? { top: offsetY } : undefined}
            aria-hidden="true"
        >
            {/* Circle indicator on the left — white outline halo for contrast on any background */}
            <div className="absolute left-1 size-2 shrink-0 rounded-full border-2 border-primary shadow-[0_0_0_1px_white]" />
            {/* Line — white outline halo ensures visibility on dark backgrounds */}
            <div className="ml-4 h-0.5 w-full bg-primary shadow-[0_0_0_1px_white]" />
        </div>
    );
}
