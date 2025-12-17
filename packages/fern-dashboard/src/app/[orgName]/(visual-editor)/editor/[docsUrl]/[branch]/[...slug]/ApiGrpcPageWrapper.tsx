"use client";

/**
 * Client-side wrapper for ApiGrpcPage that receives pre-fetched data from the server.
 */

import type { ApiDefinition } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useEffect } from "react";

import { ApiGrpcPage } from "@/docs/components/api-reference/ApiGrpcPage";
import { useDevMode } from "@/providers/DevModeProvider";

export interface ApiGrpcPageWrapperProps {
    node: FernNavigation.GrpcNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
}

export function ApiGrpcPageWrapper({ node, apiDefinition, breadcrumb }: ApiGrpcPageWrapperProps) {
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

    return <ApiGrpcPage node={node} apiDefinition={apiDefinition} breadcrumb={breadcrumb} lang="en" />;
}
