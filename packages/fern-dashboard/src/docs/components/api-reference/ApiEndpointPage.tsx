"use client";

/**
 * Dashboard-specific ApiEndpointPage (client-side, read-only).
 *
 * Entry point component for rendering HTTP endpoint API reference pages.
 * Creates endpoint context and renders EndpointContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/ApiEndpointPage.tsx
 */

import { type ApiDefinition, createEndpointContext, prune } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { EndpointContent } from "./endpoints/EndpointContent";

export interface ApiEndpointPageProps {
    node: FernNavigation.EndpointNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
}

export function ApiEndpointPage({ node, apiDefinition, breadcrumb, lang }: ApiEndpointPageProps) {
    const context = createEndpointContext(node, prune(apiDefinition, node));

    if (!context) {
        return (
            <div className="flex items-center justify-center p-8 text-center">
                <p className="text-(color:--grayscale-a11)">Could not load endpoint: {node.title}</p>
            </div>
        );
    }

    return <EndpointContent context={context} breadcrumb={breadcrumb} showErrors={true} showAuth={true} lang={lang} />;
}
