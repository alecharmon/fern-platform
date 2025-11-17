"use client";

import { t } from "@fern-docs/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { cn } from "../cn";
import GradientExclamation from "../GradientExclamation";
import { parseServerSidePathname } from "../hooks/use-current-pathname";
import { HiddenSidebar } from "../theming/HiddenSidebar";

export interface RouteSuggestion {
    slug: string;
    title: string;
    href: string;
    score: number;
    subtitle?: string;
}

export default function NotFoundContent({
    lang,
    tracker,
    actionButton,
    disableSuggestions = false,
    className,
    docsUrl,
    slug,
    hideSubtitle = false,
    branch
}: {
    lang: string;
    tracker?: React.ReactNode;
    actionButton?: React.ReactNode;
    disableSuggestions?: boolean;
    className?: string;
    /** Optional docsUrl (for fern-dashboard context) */
    docsUrl?: string;
    /** Optional specific slug to use instead of parsing from pathname (for fern-dashboard context) */
    slug?: string;
    /** Optional branch (for fern-dashboard context) */
    branch?: string;
    /** Hide the "We have been notified" subtitle */
    hideSubtitle?: boolean;
}) {
    const pathname = usePathname();
    const [suggestedRoutes, setSuggestedRoutes] = useState<RouteSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(!disableSuggestions);

    const requestedPath = slug ?? parseServerSidePathname(pathname);

    useEffect(() => {
        if (disableSuggestions) {
            setIsLoading(false);
            setSuggestedRoutes([]);
            return;
        }
        async function loadSuggestions() {
            try {
                setIsLoading(true);
                // If docsUrl is provided (fern-dashboard context), pass it as a query parameter
                // Otherwise, just pass the path (default behavior in fern-docs)
                const params = new URLSearchParams({
                    path: requestedPath,
                    ...(docsUrl && { docsUrl }),
                    ...(branch && { branch })
                });
                const apiUrl = `/api/fern-docs/route-suggestions?${params.toString()}`;

                const response = await fetch(apiUrl);
                if (response.ok) {
                    const suggestions = await response.json();
                    setSuggestedRoutes(suggestions);
                } else {
                    console.error("[NotFoundContent] Failed to load suggestions:", response.status);
                }
            } catch (error) {
                console.error("[NotFoundContent] Error loading suggestions:", error);
            } finally {
                setIsLoading(false);
            }
        }

        if (requestedPath && requestedPath !== "/") {
            loadSuggestions();
        } else {
            setIsLoading(false);
        }
    }, [requestedPath, disableSuggestions, docsUrl, branch]);

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
                <GradientExclamation />
                <div className="flex flex-col text-center gap-2">
                    <h1>{t(lang).errors.pageNotFound}</h1>
                    {!hideSubtitle && (
                        <p className="text-(color:--grayscale-a9)">{t(lang).feedback.weHaveBeenNotified}</p>
                    )}
                </div>

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
                                            <span className="text-sm text-(color:--grayscale-a10)">
                                                {route.subtitle}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {actionButton}
            </div>
        </>
    );
}
