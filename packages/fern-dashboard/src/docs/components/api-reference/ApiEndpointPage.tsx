"use client";

/**
 * Dashboard-specific ApiEndpointPage (client-side, read-only).
 *
 * Entry point component for rendering HTTP endpoint API reference pages.
 * Creates endpoint context and renders EndpointContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/ApiEndpointPage.tsx
 */

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { type ApiDefinition, createEndpointContext, prune } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useMemo } from "react";

import { ApiEditTargetProvider, createEndpointEditTarget } from "@/providers/ApiEditTargetContext";

import { EndpointContent } from "./endpoints/EndpointContent";

export interface ApiEndpointPageProps {
    node: FernNavigation.EndpointNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
    theme?: FernThemeConfig;
}

export function ApiEndpointPage({ node, apiDefinition, breadcrumb, lang, theme }: ApiEndpointPageProps) {
    const context = createEndpointContext(node, prune(apiDefinition, node));

    // Create edit target for the endpoint
    const editTarget = useMemo(() => {
        if (!context) {
            return null;
        }
        return createEndpointEditTarget(context.endpoint);
    }, [context]);

    if (!context) {
        return (
            <div className="flex items-center justify-center p-8 text-center">
                <p className="text-(color:--grayscale-a11)">Could not load endpoint: {node.title}</p>
            </div>
        );
    }

    if (!editTarget) {
        return (
            <EndpointContent
                context={context}
                breadcrumb={breadcrumb}
                showErrors={true}
                showAuth={true}
                lang={lang}
                theme={theme}
            />
        );
    }

    return (
        <ApiEditTargetProvider target={editTarget}>
            <EndpointContent
                context={context}
                breadcrumb={breadcrumb}
                showErrors={true}
                showAuth={true}
                lang={lang}
                theme={theme}
            />
        </ApiEditTargetProvider>
    );
}
