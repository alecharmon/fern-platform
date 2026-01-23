"use client";

/**
 * Dashboard-specific ApiWebSocketPage (client-side, read-only).
 *
 * Entry point component for rendering WebSocket API reference pages.
 * Creates WebSocket context and renders WebSocketContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/websockets/WebSocket.tsx
 */

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { type ApiDefinition, createWebSocketContext, prune } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { useMemo } from "react";

import { ApiEditTargetProvider, createWebSocketEditTarget } from "@/providers/ApiEditTargetContext";

import { WebSocketContent } from "./websockets/WebSocketContent";

export interface ApiWebSocketPageProps {
    node: FernNavigation.WebSocketNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
    theme?: FernThemeConfig;
}

export function ApiWebSocketPage({ node, apiDefinition, breadcrumb, lang, theme }: ApiWebSocketPageProps) {
    const context = createWebSocketContext(node, prune(apiDefinition, node));

    // Create edit target for the WebSocket channel
    // Note: WebSocket descriptions are not yet editable, but we need the target
    // to show edit-disabled indicators
    const editTarget = useMemo(() => {
        if (!context) {
            return null;
        }
        return createWebSocketEditTarget(context.channel);
    }, [context]);

    if (!context) {
        return (
            <div className="flex items-center justify-center p-8 text-center">
                <p className="text-(color:--grayscale-a11)">Could not load WebSocket: {node.title}</p>
            </div>
        );
    }

    if (!editTarget) {
        return <WebSocketContent context={context} breadcrumb={breadcrumb} lang={lang} theme={theme} />;
    }

    return (
        <ApiEditTargetProvider target={editTarget}>
            <WebSocketContent context={context} breadcrumb={breadcrumb} lang={lang} theme={theme} />
        </ApiEditTargetProvider>
    );
}
