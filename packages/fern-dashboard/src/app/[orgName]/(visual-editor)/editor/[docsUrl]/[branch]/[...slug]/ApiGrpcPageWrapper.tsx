"use client";

/**
 * Client-side wrapper for ApiGrpcPage that receives pre-fetched data from the server.
 */

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { ApiDefinition } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useEffect } from "react";

import { ApiGrpcPage } from "@/docs/components/api-reference/ApiGrpcPage";
import { useDevMode } from "@/providers/DevModeProvider";

export interface ApiGrpcPageWrapperProps {
    node: FernNavigation.GrpcNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    theme?: FernThemeConfig;
}

export function ApiGrpcPageWrapper({ node, apiDefinition, breadcrumb, theme }: ApiGrpcPageWrapperProps) {
    const { setCurrentPageType } = useDevMode();

    useEffect(() => {
        // Set page type to api-reference to enable OpenAPI spec viewing in Dev Mode
        setCurrentPageType("api-reference");

        return () => {
            // Reset page type when leaving API reference pages
            setCurrentPageType(null);
        };
    }, [setCurrentPageType]);

    return <ApiGrpcPage node={node} apiDefinition={apiDefinition} breadcrumb={breadcrumb} lang="en" theme={theme} />;
}
