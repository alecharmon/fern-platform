"use client";

/**
 * Client-side wrapper for ApiWebSocketPage that receives pre-fetched data from the server.
 */

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { ApiDefinition } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useEffect } from "react";

import { ApiWebSocketPage } from "@/docs/components/api-reference/ApiWebSocketPage";
import { useDevMode } from "@/providers/DevModeProvider";

export interface ApiWebSocketPageWrapperProps {
    node: FernNavigation.WebSocketNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    theme?: FernThemeConfig;
}

export function ApiWebSocketPageWrapper({ node, apiDefinition, breadcrumb, theme }: ApiWebSocketPageWrapperProps) {
    const { setCurrentPageType } = useDevMode();

    useEffect(() => {
        // Set page type to api-reference to enable OpenAPI spec viewing in Dev Mode
        setCurrentPageType("api-reference");

        return () => {
            // Reset page type when leaving API reference pages
            setCurrentPageType(null);
        };
    }, [setCurrentPageType]);

    return (
        <ApiWebSocketPage node={node} apiDefinition={apiDefinition} breadcrumb={breadcrumb} lang="en" theme={theme} />
    );
}
