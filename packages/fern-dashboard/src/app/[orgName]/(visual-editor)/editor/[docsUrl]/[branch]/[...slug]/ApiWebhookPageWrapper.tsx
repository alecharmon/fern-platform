"use client";

/**
 * Client-side wrapper for ApiWebhookPage that receives pre-fetched data from the server.
 */

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { ApiDefinition } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useEffect } from "react";

import { ApiWebhookPage } from "@/docs/components/api-reference/ApiWebhookPage";
import { useDevMode } from "@/providers/DevModeProvider";

export interface ApiWebhookPageWrapperProps {
    node: FernNavigation.WebhookNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    theme?: FernThemeConfig;
}

export function ApiWebhookPageWrapper({ node, apiDefinition, breadcrumb, theme }: ApiWebhookPageWrapperProps) {
    const { setCurrentPageType } = useDevMode();

    useEffect(() => {
        // Set page type to api-reference to enable OpenAPI spec viewing in Dev Mode
        setCurrentPageType("api-reference");

        return () => {
            // Reset page type when leaving API reference pages
            setCurrentPageType(null);
        };
    }, [setCurrentPageType]);

    return <ApiWebhookPage node={node} apiDefinition={apiDefinition} breadcrumb={breadcrumb} lang="en" theme={theme} />;
}
