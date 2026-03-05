"use client";

import type React from "react";
import { cn } from "../cn";
import GradientExclamation from "../GradientExclamation";
import { HiddenSidebar } from "../theming/HiddenSidebar";

export interface GradientErrorPageProps {
    /** Icon to display - defaults to GradientExclamation */
    icon?: React.ReactNode;
    /** Main title/heading */
    title: string;
    /** Optional subtitle text */
    subtitle?: string;
    /** Additional content to display below title/subtitle */
    children?: React.ReactNode;
    /** Additional CSS classes for the container */
    className?: string;
    /** Optional tracker component (e.g., analytics) */
    tracker?: React.ReactNode;
}

/**
 * Base component for gradient error pages (404, 500, etc.)
 * Displays a centered layout with:
 * - Gradient icon (default: exclamation triangle)
 * - Title
 * - Optional subtitle
 * - Optional children for custom content
 */
export function GradientErrorPage({ icon, title, subtitle, children, className, tracker }: GradientErrorPageProps) {
    return (
        <>
            {tracker}
            <HiddenSidebar />
            <div
                className={cn(
                    "flex h-[calc(100svh-var(--header-height)-6rem)] w-screen flex-col items-center justify-center gap-6",
                    className
                )}
            >
                {icon ?? <GradientExclamation />}
                <div className="flex flex-col text-center gap-2">
                    <h1>{title}</h1>
                    {subtitle && <p className="text-(color:--grayscale-a9)">{subtitle}</p>}
                </div>
                {children}
            </div>
        </>
    );
}
