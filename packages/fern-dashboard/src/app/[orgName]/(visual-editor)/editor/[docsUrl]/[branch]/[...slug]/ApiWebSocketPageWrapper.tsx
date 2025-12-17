"use client";

/**
 * Client-side wrapper for ApiWebSocketPage that receives pre-fetched data from the server.
 */

import type { ApiDefinition } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useEffect } from "react";

import { ApiWebSocketPage } from "@/docs/components/api-reference/ApiWebSocketPage";
import { useDevMode } from "@/providers/DevModeProvider";

export interface ApiWebSocketPageWrapperProps {
    node: FernNavigation.WebSocketNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
}

export function ApiWebSocketPageWrapper({ node, apiDefinition, breadcrumb }: ApiWebSocketPageWrapperProps) {
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

    return <ApiWebSocketPage node={node} apiDefinition={apiDefinition} breadcrumb={breadcrumb} lang="en" />;
}
