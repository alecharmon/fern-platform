"use client";

/**
 * Client-side wrapper for ApiWebhookPage that receives pre-fetched data from the server.
 */

import type { ApiDefinition } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useEffect } from "react";

import { ApiWebhookPage } from "@/docs/components/api-reference/ApiWebhookPage";
import { useDevMode } from "@/providers/DevModeProvider";

export interface ApiWebhookPageWrapperProps {
    node: FernNavigation.WebhookNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
}

export function ApiWebhookPageWrapper({ node, apiDefinition, breadcrumb }: ApiWebhookPageWrapperProps) {
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

    return <ApiWebhookPage node={node} apiDefinition={apiDefinition} breadcrumb={breadcrumb} lang="en" />;
}
