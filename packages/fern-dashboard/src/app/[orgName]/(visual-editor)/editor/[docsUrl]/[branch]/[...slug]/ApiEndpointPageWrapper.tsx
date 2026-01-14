"use client";

/**
 * Client-side wrapper for ApiEndpointPage that receives pre-fetched data from the server.
 */

import type { ApiDefinition } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useEffect } from "react";

import { ApiEndpointPage } from "@/docs/components/api-reference/ApiEndpointPage";
import { useDevMode } from "@/providers/DevModeProvider";

export interface ApiEndpointPageWrapperProps {
    node: FernNavigation.EndpointNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
}

export function ApiEndpointPageWrapper({ node, apiDefinition, breadcrumb }: ApiEndpointPageWrapperProps) {
    const { setCurrentPageType } = useDevMode();

    useEffect(() => {
        // Set page type to api-reference to enable OpenAPI spec viewing in Dev Mode
        setCurrentPageType("api-reference");

        return () => {
            // Reset page type when leaving API reference pages
            setCurrentPageType(null);
        };
    }, [setCurrentPageType]);

    return <ApiEndpointPage node={node} apiDefinition={apiDefinition} breadcrumb={breadcrumb} lang="en" />;
}
