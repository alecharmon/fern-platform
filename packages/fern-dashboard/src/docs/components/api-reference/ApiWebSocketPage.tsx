"use client";

/**
 * Dashboard-specific ApiWebSocketPage (client-side, read-only).
 *
 * Entry point component for rendering WebSocket API reference pages.
 * Creates WebSocket context and renders WebSocketContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/websockets/WebSocket.tsx
 */

import { type ApiDefinition, createWebSocketContext, prune } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { WebSocketContent } from "./websockets/WebSocketContent";

export interface ApiWebSocketPageProps {
    node: FernNavigation.WebSocketNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
}

export function ApiWebSocketPage({ node, apiDefinition, breadcrumb, lang }: ApiWebSocketPageProps) {
    const context = createWebSocketContext(node, prune(apiDefinition, node));

    if (!context) {
        return (
            <div className="flex items-center justify-center p-8 text-center">
                <p className="text-(color:--grayscale-a11)">Could not load WebSocket: {node.title}</p>
            </div>
        );
    }

    return <WebSocketContent context={context} breadcrumb={breadcrumb} lang={lang} />;
}
