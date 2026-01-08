"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { SplitLayout } from "./SplitLayout";

export interface AuthLayoutClientProps {
    /**
     * Content to render in the white card
     */
    cardContent: ReactNode;

    /**
     * Content to render in the background section
     */
    backgroundContent: ReactNode;

    /**
     * Overlay content (logo, buttons, etc.)
     */
    overlay?: ReactNode;

    /**
     * Force center the card (overrides route-based logic)
     */
    forceCenter?: boolean;

    /**
     * Animation duration in milliseconds
     * @default 500
     */
    animationDuration?: number;
}

/**
 * Client-side wrapper for auth pages that handles route-based animations.
 * Automatically centers the card when navigating from /login to /get-started
 */
export const AuthLayoutClient = ({
    cardContent,
    backgroundContent,
    overlay,
    forceCenter,
    animationDuration = 500
}: AuthLayoutClientProps) => {
    const pathname = usePathname();

    // Initialize state based on current route
    const [centerCard, setCenterCard] = useState(() => {
        return forceCenter ?? pathname === "/get-started";
    });

    useEffect(() => {
        // Determine if card should be centered based on route
        const shouldCenter = forceCenter ?? pathname === "/get-started";

        // Small delay to ensure smooth animation on route transition
        const timer = setTimeout(() => {
            setCenterCard(shouldCenter);
        }, 50);

        return () => clearTimeout(timer);
    }, [pathname, forceCenter]);

    return (
        <SplitLayout
            cardContent={cardContent}
            backgroundContent={backgroundContent}
            overlay={overlay}
            centerCard={centerCard}
            animationDuration={animationDuration}
        />
    );
};
