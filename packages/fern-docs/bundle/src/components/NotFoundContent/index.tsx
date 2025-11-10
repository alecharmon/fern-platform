"use client";

import GradientExclamation from "@fern-docs/components/GradientExclamation";
import { parseServerSidePathname } from "@fern-docs/components/hooks/use-current-pathname";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";
import { t } from "@fern-docs/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NotFound404Tracker } from "../analytics/NotFound404Tracker";
import ReturnHomeButton from "../ReturnHomeButton";
export interface RouteSuggestion {
    slug: string;
    title: string;
    href: string;
    score: number;
    subtitle?: string;
}

export default function NotFoundContent({ lang }: { lang: string }) {
    const pathname = usePathname();
    const [suggestedRoutes, setSuggestedRoutes] = useState<RouteSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const requestedPath = parseServerSidePathname(pathname);

    useEffect(() => {
        async function loadSuggestions() {
            try {
                setIsLoading(true);
                const response = await fetch(
                    `/api/fern-docs/route-suggestions?path=${encodeURIComponent(requestedPath)}`
                );
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
    }, [requestedPath]);

    return (
        <>
            <NotFound404Tracker />
            <HiddenSidebar />
            <div className="flex h-[calc(100svh-var(--header-height)-6rem)] w-screen flex-col items-center justify-center gap-6">
                <GradientExclamation />
                <div className="flex flex-col text-center gap-2">
                    <h1>{t(lang).errors.pageNotFound}</h1>
                    <p className="text-(color:--grayscale-a9)">{t(lang).feedback.weHaveBeenNotified}</p>
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

                <ReturnHomeButton lang={lang} />
            </div>
        </>
    );
}
