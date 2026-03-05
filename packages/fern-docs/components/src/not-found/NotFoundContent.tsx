"use client";

import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { NotFoundPageBase, type RouteSuggestion } from "../error-pages/NotFoundPageBase";
import { parseServerSidePathname } from "../hooks/use-current-pathname";

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
        <NotFoundPageBase
            lang={lang}
            tracker={tracker}
            actionButton={actionButton}
            className={className}
            hideSubtitle={hideSubtitle}
            isLoading={isLoading}
            suggestedRoutes={suggestedRoutes}
            requestedPath={requestedPath}
        />
    );
}
