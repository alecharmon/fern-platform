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
    const { setPanelOpen, setDevModeDisabled } = useDevMode();

    useEffect(() => {
        // Disable dev mode for API reference pages
        setDevModeDisabled(true);
        // Close the panel if it's open
        setPanelOpen(false);

        return () => {
            // Re-enable dev mode when leaving API reference pages
            setDevModeDisabled(false);
        };
    }, [setPanelOpen, setDevModeDisabled]);

    return <ApiEndpointPage node={node} apiDefinition={apiDefinition} breadcrumb={breadcrumb} lang="en" />;
}
