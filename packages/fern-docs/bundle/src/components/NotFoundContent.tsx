"use client";

import { cn } from "@fern-docs/components/cn";
import GradientExclamation from "@fern-docs/components/GradientExclamation";
import { parseServerSidePathname, useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";
import { t } from "@fern-docs/i18n";
import Link from "next/link";
import type React from "react";
import { useMemo } from "react";
import { z } from "zod";
import { NotFound404Tracker } from "./analytics/NotFound404Tracker";
import { useApiRouteSWR } from "./hooks/useApiRouteSWR";

export interface RouteSuggestion {
    slug: string;
    title: string;
    href: string;
    score: number;
    subtitle?: string;
}

const RouteSuggestionsSchema = z.array(
    z.object({
        slug: z.string(),
        title: z.string(),
        href: z.string(),
        score: z.number(),
        subtitle: z.string().optional()
    })
);

export default function NotFoundContent({
    lang,
    actionButton,
    disableSuggestions = false,
    className,
    docsUrl,
    slug,
    hideSubtitle = false,
    branch
}: {
    lang: string;
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
    const pathname = useCurrentPathname();
    const requestedPath = slug ?? parseServerSidePathname(pathname);

    // Build query parameters
    const queryParams = useMemo(() => {
        const params = new URLSearchParams({
            path: requestedPath
        });
        if (docsUrl) {
            params.append("docsUrl", docsUrl);
        }
        if (branch) {
            params.append("branch", branch);
        }
        return params.toString();
    }, [requestedPath, docsUrl, branch]);

    // Only fetch if suggestions are enabled and path is not root
    const shouldFetch = !disableSuggestions && requestedPath && requestedPath !== "/";

    const { data: suggestedRoutes, isLoading } = useApiRouteSWR<RouteSuggestion[]>(
        `/api/fern-docs/route-suggestions?${queryParams}` as "/api/fern-docs/route-suggestions",
        {
            disabled: !shouldFetch,
            validate: RouteSuggestionsSchema
        }
    );

    return (
        <>
            <NotFound404Tracker />
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

                {!isLoading && suggestedRoutes && suggestedRoutes.length > 0 && (
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
