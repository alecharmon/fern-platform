import { createPruneKey } from "@fern-api/docs-loader";
import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { type ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import { createEndpointContext, createWebSocketContext, type EndpointContext } from "@fern-api/fdr-sdk/api-definition";
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
        if (!context) {
            return null;
        }

        let oauthReferencedContext: EndpointContext | undefined;
        const firstAuth = context.auths[0];
        if (firstAuth?.type === "oAuth") {
            const oAuthValue = firstAuth.value;
            if (oAuthValue.type === "clientCredentials") {
                const clientCredentials = oAuthValue.value;
                if (clientCredentials.type === "referencedEndpoint") {
                    const referencedEndpoint = clientCredentials;
                    try {
                        const { endpoint, nodes, globalHeaders, authSchemes, types } = await loader.getEndpointById(
                            node.apiDefinitionId,
                            referencedEndpoint.endpointId
                        );
                        if (endpoint != null && nodes[0] != null) {
                            oauthReferencedContext = {
                                node: nodes[0],
                                endpoint,
                                globalHeaders,
                                auths: authSchemes.filter((a) => a.type !== "oAuth"),
                                authsWithKeys: [], // OAuth referenced endpoints don't need authsWithKeys
                                types
                            };
                        }
                    } catch (e) {
                        console.error(`[explorer-content:getEndpointById] ${JSON.stringify(e)}`);
                    }
                }
            }
        }

        const authForm = context.authsWithKeys.length > 0 && (
            <PlaygroundAuthorizationFormCard
                context={context}
                oauthReferencedContext={oauthReferencedContext}
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
        if (!context) {
            return null;
        }
        const authForm = context.authsWithKeys.length > 0 && (
            <PlaygroundAuthorizationFormCard context={context} lang={lang} />
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
