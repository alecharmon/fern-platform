"use client";

import { NotFoundPageBase, type RouteSuggestion } from "@fern-docs/components/error-pages/NotFoundPageBase";
import { parseServerSidePathname, useCurrentPathname } from "@fern-docs/components/hooks/use-current-pathname";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { NotFound404Tracker } from "./analytics/NotFound404Tracker";
import { useApiRouteSWR } from "./hooks/useApiRouteSWR";

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
    const hasRevalidated = useRef(false);

    // Revalidate the current route so cached 404s self-heal.
    // When content is later published for this path, the next request
    // after this revalidation will serve the real page instead of 404.
    useEffect(() => {
        if (hasRevalidated.current || !requestedPath || requestedPath === "/") {
            return;
        }
        hasRevalidated.current = true;
        const params = new URLSearchParams({ path: requestedPath });
        fetch(`/api/fern-docs/revalidate-path?${params.toString()}`).catch((error) => {
            console.error("[NotFoundContent] Failed to revalidate path:", error);
        });
    }, [requestedPath]);

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
        <NotFoundPageBase
            lang={lang}
            tracker={<NotFound404Tracker />}
            actionButton={actionButton}
            className={className}
            hideSubtitle={hideSubtitle}
            isLoading={isLoading}
            suggestedRoutes={suggestedRoutes}
            requestedPath={requestedPath}
        />
    );
}
