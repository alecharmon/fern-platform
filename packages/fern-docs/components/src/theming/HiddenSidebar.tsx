"use client";

import { useEffect, useId } from "react";

export function HiddenSidebar() {
    const id = useId();

    useEffect(() => {
        const elementId = `hidden-sidebar-styles-${id}`;

        // Create and inject styles
        const style = document.createElement("style");
        style.id = elementId;
        style.textContent = `
            #fern-toc,
            #fern-sidebar[data-state="sticky"],
            #fern-sidebar[data-state="fixed"],
            #fern-sidebar-spacer {
                visibility: hidden;
                width: 0;
                overflow: hidden;
                display: none;
            }
        `;
        document.head.appendChild(style);

        // Cleanup function
        return () => {
            const existingStyle = document.getElementById(elementId);
            if (existingStyle) {
                existingStyle.remove();
            }
        };
    }, [id]);

    return null;
}
