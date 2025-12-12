"use client";

import { useSetAtom } from "jotai";
import { type ReactNode, useEffect, useRef } from "react";

import { SCROLL_BODY_ATOM } from "../state/viewport";

interface CanvasWrapperProps {
    children: ReactNode;
}

/**
 * A wrapper component for canvas theme that sets the scroll body atom
 * to this element so that the Table of Contents observer can properly
 * track scroll position within the canvas container.
 */
export function CanvasWrapper({ children }: CanvasWrapperProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const setScrollBody = useSetAtom(SCROLL_BODY_ATOM);

    useEffect(() => {
        if (wrapperRef.current) {
            setScrollBody(wrapperRef.current);
        }
        return () => {
            // Reset to document when unmounted
            setScrollBody(document);
        };
    }, [setScrollBody]);

    return (
        <div ref={wrapperRef} className="canvas-wrapper">
            {children}
        </div>
    );
}
