import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import visitDiscriminatedUnion from "@fern-api/ui-core-utils/visitDiscriminatedUnion";

import { PlaygroundBearerAuthForm } from "./PlaygroundBearerAuthForm";
import { FoundOAuthReferencedEndpointForm } from "./PlaygroundOAuthForm";

async function OAuthReferencedEndpointForm({
    loader,
    apiDefinitionId,
    referencedEndpoint,
    disabled,
    lang
}: {
    loader: DocsLoader;
    apiDefinitionId: string;
    referencedEndpoint: APIV1Read.OAuthClientCredentials.ReferencedEndpoint;
    disabled?: boolean;
    lang: string;
}) {
    try {
        const { endpoint, nodes, globalHeaders, authSchemes, types } = await loader.getEndpointById(
            apiDefinitionId,
            referencedEndpoint.endpointId
        );

        if (endpoint == null) {
            return (
                <PlaygroundBearerAuthForm
                    bearerAuth={{ tokenName: "token", description: undefined }}
                    disabled={disabled}
                    lang={lang}
                />
            );
        }

        return (
            <FoundOAuthReferencedEndpointForm
                context={{
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    node: nodes[0]!,
                    endpoint,
                    globalHeaders,
                    auths: authSchemes.filter((auth) => auth.type !== "oAuth"),
                    types
                }}
                referencedEndpoint={referencedEndpoint}
                disabled={disabled}
                lang={lang}
            />
        );
    } catch (e) {
        console.error(`[playground-oauth-form-server] ${JSON.stringify(e)}`);
        return (
            <PlaygroundBearerAuthForm
                bearerAuth={{ tokenName: "token", description: undefined }}
                disabled={disabled}
                lang={lang}
            />
        );
    }
}

export async function PlaygroundOAuthFormServer({
    loader,
    apiDefinitionId,
    oAuth,
    disabled,
    lang
}: {
    loader: DocsLoader;
    apiDefinitionId: string;
    oAuth: APIV1Read.ApiAuth.OAuth;
    disabled?: boolean;
    lang: string;
}): Promise<React.ReactNode> {
    return visitDiscriminatedUnion(oAuth.value, "type")._visit({
        clientCredentials: (clientCredentials) =>
            visitDiscriminatedUnion(clientCredentials.value, "type")._visit({
                referencedEndpoint: (referencedEndpoint) => (
                    <OAuthReferencedEndpointForm
                        loader={loader}
                        apiDefinitionId={apiDefinitionId}
                        referencedEndpoint={referencedEndpoint}
                        disabled={disabled}
                        lang={lang}
                    />
                ),
                _other: () => null
            }),
        _other: () => null
    });
}
