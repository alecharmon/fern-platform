"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { OpenApiResolverFailureReason } from "@/providers/OpenApiSpecsContext";

import { getEditDisabledMessage } from "./edit-disabled-message";

export interface MouseFollowingTooltipProps {
    /** Reason why editing is disabled */
    reason?: OpenApiResolverFailureReason;
    /** Content to wrap with the tooltip behavior */
    children: ReactNode;
    /** Delay before showing tooltip in ms (default: 150) */
    delay?: number;
    /** Offset from cursor in pixels (default: 12) */
    offset?: number;
}

/**
 * Mouse-following tooltip for non-editable descriptions.
 *
 * Shows a tooltip that follows the mouse cursor when hovering over the wrapped content.
 * Used to indicate why a description cannot be edited.
 */
export function MouseFollowingTooltip({ reason, children, delay = 150, offset = 12 }: MouseFollowingTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isHoveringRef = useRef(false);

    const message = getEditDisabledMessage(reason);

    const handleMouseEnter = useCallback(() => {
        isHoveringRef.current = true;
        timeoutRef.current = setTimeout(() => {
            if (isHoveringRef.current) {
                setIsVisible(true);
            }
        }, delay);
    }, [delay]);

    const handleMouseLeave = useCallback(() => {
        isHoveringRef.current = false;
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    }, []);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            setPosition({ x: e.clientX + offset, y: e.clientY + offset });
        },
        [offset]
    );

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <>
            <div
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                className="cursor-default"
            >
                {children}
            </div>
            {isVisible &&
                createPortal(
                    <div
                        className="pointer-events-none fixed z-50 rounded-md border-none bg-[#252529] p-2 text-center text-sm leading-normal text-white shadow-lg"
                        style={{
                            left: position.x,
                            top: position.y
                        }}
                    >
                        {message}
                    </div>,
                    document.body
                )}
        </>
    );
}
