"use client";

/**
 * Dashboard-specific ApiWebhookPage (client-side, read-only).
 *
 * Entry point component for rendering Webhook API reference pages.
 * Creates Webhook context and renders WebhookContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/webhooks/WebhookContent.tsx
 */

import { type ApiDefinition, createWebhookContext, prune } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { WebhookContent } from "./webhooks/WebhookContent";

export interface ApiWebhookPageProps {
    node: FernNavigation.WebhookNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
}

export function ApiWebhookPage({ node, apiDefinition, breadcrumb, lang }: ApiWebhookPageProps) {
    const context = createWebhookContext(node, prune(apiDefinition, node));

    if (!context) {
        return (
            <div className="flex items-center justify-center p-8 text-center">
                <p className="text-(color:--grayscale-a11)">Could not load Webhook: {node.title}</p>
            </div>
        );
    }

    return <WebhookContent context={context} breadcrumb={breadcrumb} lang={lang} />;
}
