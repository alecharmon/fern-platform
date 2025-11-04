import { createPruneKey } from "@fern-api/docs-loader";
import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { type ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import { createEndpointContext, createWebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import type { NavigationNodePage } from "@fern-api/fdr-sdk/navigation";
import { t } from "@fern-docs/i18n";
import { ArrowLeft } from "lucide-react";
import { ApiDefinitionIdProvider } from "@/contexts/ApiDefinitionIdContext";

import { PlaygroundAuthorizationFormCard } from "./auth";
import { PlaygroundEndpoint } from "./endpoint";
import { PlaygroundWebSocket } from "./websocket";

export async function ExplorerContent({
    loader,
    node,
    lang
}: {
    loader: DocsLoader;
    node: NavigationNodePage;
    lang: string;
}) {
    if (!FernNavigation.isApiLeaf(node)) {
        return <NoEndpointSelected lang={lang} />;
    }

    let api: ApiDefinition.ApiDefinition | undefined;
    let dynamicIRsByLanguage: DynamicIRsByLanguage | undefined = {};
    let disableProxy: boolean | undefined = undefined;

    try {
        api = await loader.getPrunedApi(node.apiDefinitionId, createPruneKey(node));
    } catch (error) {
        console.error(`[explorer-content:getPrunedApi] ${JSON.stringify(error)}`);
        // TODO: don't revalidate too often
        // revalidate(await loader.getBaseUrl());
    }

    if (api == null) {
        return <NoEndpointSelected lang={lang} />;
    }

    try {
        dynamicIRsByLanguage = await loader.getDynamicIr(node.apiDefinitionId);
    } catch (error) {
        console.error(`[explorer-content:getDynamicIr] ${JSON.stringify(error)}`);
    }

    try {
        const { disableExplorerProxy } = await loader.getSettings();
        disableProxy = disableExplorerProxy;
    } catch (error) {
        console.error(`[explorer-content:getSettings] ${JSON.stringify(error)}`);
    }

    if (node.type === "endpoint") {
        const context = createEndpointContext(node, api);
        if (!context) return null;
        const authForm = context.auths[0] != null && (
            <PlaygroundAuthorizationFormCard
                loader={loader}
                apiDefinitionId={node.apiDefinitionId}
                auth={context.auths[0]}
                lang={lang}
            />
        );
        return (
            <ApiDefinitionIdProvider value={node.apiDefinitionId}>
                <PlaygroundEndpoint
                    context={context}
                    authForm={authForm}
                    dynamicIRsByLanguage={dynamicIRsByLanguage}
                    disableProxy={disableProxy}
                    lang={lang}
                />
            </ApiDefinitionIdProvider>
        );
    } else if (node.type === "webSocket") {
        const context = createWebSocketContext(node, api);
        if (!context) return null;
        const authForm = context.auths[0] != null && (
            <PlaygroundAuthorizationFormCard
                loader={loader}
                apiDefinitionId={node.apiDefinitionId}
                auth={context.auths[0]}
                lang={lang}
            />
        );
        return (
            <ApiDefinitionIdProvider value={node.apiDefinitionId}>
                <PlaygroundWebSocket context={context} authForm={authForm} lang={lang} />
            </ApiDefinitionIdProvider>
        );
    }
    return <NoEndpointSelected lang={lang} />;
}

export function NoEndpointSelected({ lang }: { lang: string }) {
    return (
        <div className="flex size-full flex-col items-center justify-center">
            <ArrowLeft className="t-muted mb-2 size-8" />
            <h6 className="t-muted">{t(lang).playground.selectAnEndpointToGetStarted}</h6>
        </div>
    );
}
