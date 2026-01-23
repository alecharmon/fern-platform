"use client";

/**
 * Dashboard-specific ApiWebhookPage (client-side, read-only).
 *
 * Entry point component for rendering Webhook API reference pages.
 * Creates Webhook context and renders WebhookContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/webhooks/WebhookContent.tsx
 */

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { type ApiDefinition, createWebhookContext, prune } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useMemo } from "react";

import { ApiEditTargetProvider, createWebhookEditTarget } from "@/providers/ApiEditTargetContext";

import { WebhookContent } from "./webhooks/WebhookContent";

export interface ApiWebhookPageProps {
    node: FernNavigation.WebhookNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
    theme?: FernThemeConfig;
}

export function ApiWebhookPage({ node, apiDefinition, breadcrumb, lang, theme }: ApiWebhookPageProps) {
    const context = createWebhookContext(node, prune(apiDefinition, node));

    // Create edit target for the Webhook
    // Note: Webhook descriptions are not yet editable, but we need the target
    // to show edit-disabled indicators
    const editTarget = useMemo(() => {
        if (!context) {
            return null;
        }
        return createWebhookEditTarget(context.webhook);
    }, [context]);

    if (!context) {
        return (
            <div className="flex items-center justify-center p-8 text-center">
                <p className="text-(color:--grayscale-a11)">Could not load Webhook: {node.title}</p>
            </div>
        );
    }

    if (!editTarget) {
        return <WebhookContent context={context} breadcrumb={breadcrumb} lang={lang} theme={theme} />;
    }

    return (
        <ApiEditTargetProvider target={editTarget}>
            <WebhookContent context={context} breadcrumb={breadcrumb} lang={lang} theme={theme} />
        </ApiEditTargetProvider>
    );
}
