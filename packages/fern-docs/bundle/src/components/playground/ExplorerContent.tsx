import { ArrowLeft } from "lucide-react";

import { createPruneKey } from "@fern-api/docs-loader";
import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { type ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import { createEndpointContext, createWebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import type { NavigationNodePage } from "@fern-api/fdr-sdk/navigation";

import { PlaygroundAuthorizationFormCard } from "./auth";
import { PlaygroundEndpoint } from "./endpoint";
import { PlaygroundWebSocket } from "./websocket";

export async function ExplorerContent({ loader, node }: { loader: DocsLoader; node: NavigationNodePage }) {
    if (!FernNavigation.isApiLeaf(node)) {
        return <NoEndpointSelected />;
    }

    let api: ApiDefinition.ApiDefinition | undefined;
    let dynamicIRsByLanguage: DynamicIRsByLanguage | undefined = {};

    try {
        api = await loader.getPrunedApi(node.apiDefinitionId, createPruneKey(node));
    } catch (error) {
        console.error(`[explorer-content:getPrunedApi] ${JSON.stringify(error)}`);
        // TODO: don't revalidate too often
        // revalidate(await loader.getBaseUrl());
    }

    if (api == null) {
        return <NoEndpointSelected />;
    }

    try {
        dynamicIRsByLanguage = await loader.getDynamicIr(node.apiDefinitionId);
    } catch (error) {
        console.error(`[explorer-content:getDynamicIr] ${JSON.stringify(error)}`);
    }

    if (node.type === "endpoint") {
        const context = createEndpointContext(node, api);
        if (!context) return null;
        const authForm = context.auth != null && (
            <PlaygroundAuthorizationFormCard
                loader={loader}
                apiDefinitionId={node.apiDefinitionId}
                auth={context.auth}
            />
        );
        return <PlaygroundEndpoint context={context} authForm={authForm} dynamicIRsByLanguage={dynamicIRsByLanguage} />;
    } else if (node.type === "webSocket") {
        const context = createWebSocketContext(node, api);
        if (!context) return null;
        const authForm = context.auth != null && (
            <PlaygroundAuthorizationFormCard
                loader={loader}
                apiDefinitionId={node.apiDefinitionId}
                auth={context.auth}
            />
        );
        return <PlaygroundWebSocket context={context} authForm={authForm} />;
    }
    return <NoEndpointSelected />;
}

export function NoEndpointSelected() {
    return (
        <div className="flex size-full flex-col items-center justify-center">
            <ArrowLeft className="t-muted mb-2 size-8" />
            <h6 className="t-muted">Select an endpoint to get started</h6>
        </div>
    );
}
