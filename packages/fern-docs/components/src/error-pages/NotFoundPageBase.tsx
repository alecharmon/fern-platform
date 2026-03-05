"use client";

import { t } from "@fern-docs/i18n";
import Link from "next/link";
import type React from "react";
import { GradientErrorPage } from "./GradientErrorPage";

export interface RouteSuggestion {
    slug: string;
    title: string;
    href: string;
    score: number;
    subtitle?: string;
}

export interface NotFoundPageBaseProps {
    /** Language code for i18n */
    lang: string;
    /** Tracker component (e.g., analytics) */
    tracker?: React.ReactNode;
    /** Action button to display */
    actionButton?: React.ReactNode;
    /** Additional CSS classes for the container */
    className?: string;
    /** Hide the "We have been notified" subtitle */
    hideSubtitle?: boolean;
    /** Loading state for suggestions */
    isLoading?: boolean;
    /** Suggested routes to display */
    suggestedRoutes?: RouteSuggestion[];
    /** The requested path (for showing loading message) */
    requestedPath?: string;
}

/**
 * Base 404 Not Found page component with route suggestions.
 * This is the shared UI for NotFoundContent in both bundle and components.
 *
 * The parent component is responsible for:
 * - Fetching route suggestions
 * - Managing loading state
 * - Determining the requested path
 */
export function NotFoundPageBase({
    lang,
    tracker,
    actionButton,
    className,
    hideSubtitle = false,
    isLoading = false,
    suggestedRoutes = [],
    requestedPath
}: NotFoundPageBaseProps) {
    const subtitle = hideSubtitle ? undefined : t(lang).feedback.weHaveBeenNotified;

    return (
        <GradientErrorPage
            title={t(lang).errors.pageNotFound}
            subtitle={subtitle}
            className={className}
            tracker={tracker}
        >
            {isLoading && requestedPath && requestedPath !== "/" && (
                <div className="text-sm text-(color:--grayscale-a11)">{t(lang).errors.findingSimilarPages}</div>
            )}

            {!isLoading && suggestedRoutes.length > 0 && (
                <div className="flex flex-col items-center gap-3 max-w-md w-full px-4">
                    <p className="text-sm text-(color:--grayscale-a11) font-medium">
                        {t(lang).errors.wereYouLookingForOneOfThese}
                    </p>
                    <div className="flex flex-col gap-2 w-full">
                        {suggestedRoutes.map((route) => (
                            <Link
                                key={route.slug}
                                href={route.href}
                                className="px-4 py-3 rounded-3/2 border border-(color:--grayscale-a6) bg-(color:--grayscale-a2) hover:bg-(color:--grayscale-a3) hover:border-(color:--grayscale-a7) transition-colors text-left"
                            >
                                <div className="flex flex-col gap-1">
                                    <span className="text-(color:--grayscale-a12) font-medium">{route.title}</span>
                                    {route.subtitle && (
                                        <span className="text-sm text-(color:--grayscale-a10)">{route.subtitle}</span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {actionButton}
        </GradientErrorPage>
    );
}
