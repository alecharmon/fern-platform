"use client";

import GradientExclamation from "@fern-docs/components/GradientExclamation";
import { parseServerSidePathname } from "@fern-docs/components/hooks/use-current-pathname";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NotFound404Tracker } from "../analytics/NotFound404Tracker";
import ReturnHomeButton from "../ReturnHomeButton";
import { getRouteSuggestions, type RouteSuggestion } from "./get-route-suggestions";

export default function NotFoundContent() {
    const pathname = usePathname();
    const [suggestedRoutes, setSuggestedRoutes] = useState<RouteSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const requestedPath = parseServerSidePathname(pathname);

    useEffect(() => {
        async function loadSuggestions() {
            try {
                setIsLoading(true);
                const suggestions = await getRouteSuggestions(requestedPath);
                setSuggestedRoutes(suggestions);
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
                    <h1>Sorry, we couldn&apos;t find that page</h1>
                    <p className="text-(color:--grayscale-a9)">
                        We&apos;ve been notified so we can fix this for next time.
                    </p>
                </div>

                {isLoading && requestedPath && requestedPath !== "/" && (
                    <div className="text-sm text-(color:--grayscale-a11)">Finding similar pages...</div>
                )}

                {!isLoading && suggestedRoutes.length > 0 && (
                    <div className="flex flex-col items-center gap-3 max-w-md w-full px-4">
                        <p className="text-sm text-(color:--grayscale-a11) font-medium">
                            How about one of these pages?
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
                                        <span className="text-sm text-(color:--grayscale-a10)">{route.href}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <ReturnHomeButton />
            </div>
        </>
    );
}
