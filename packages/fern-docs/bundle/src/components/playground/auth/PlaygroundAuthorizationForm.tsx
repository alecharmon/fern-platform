import type { EndpointContext, WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import type { FC, ReactElement } from "react";

import { PlaygroundBasicAuthForm } from "./PlaygroundBasicAuthForm";
import { PlaygroundBearerAuthForm } from "./PlaygroundBearerAuthForm";
import { PlaygroundHeaderAuthForm } from "./PlaygroundHeaderAuthForm";
import { FoundOAuthReferencedEndpointForm } from "./PlaygroundOAuthForm";

interface PlaygroundAuthorizationFormProps {
    auth: APIV1Read.ApiAuth;
    authKey: string;
    context: EndpointContext | WebSocketContext;
    oauthReferencedContext?: EndpointContext;
    disabled: boolean;
    lang: string;
}

export const PlaygroundAuthorizationForm: FC<PlaygroundAuthorizationFormProps> = ({
    auth,
    authKey,
    context,
    oauthReferencedContext,
    disabled,
    lang
}) => {
    return (
        <ul className="list-none px-4">
            {visitDiscriminatedUnion(auth, "type")._visit<ReactElement<any> | false>({
                bearerAuth: (bearerAuth) => (
                    <PlaygroundBearerAuthForm bearerAuth={bearerAuth} disabled={disabled} lang={lang} />
                ),
                basicAuth: (basicAuth) => (
                    <PlaygroundBasicAuthForm basicAuth={basicAuth} disabled={disabled} lang={lang} />
                ),
                header: (header) => (
                    <PlaygroundHeaderAuthForm header={header} authKey={authKey} disabled={disabled} lang={lang} />
                ),
                oAuth: (oAuth) => {
                    if ("endpoint" in context) {
                        return visitDiscriminatedUnion(oAuth.value, "type")._visit({
                            clientCredentials: (clientCredentials) =>
                                visitDiscriminatedUnion(clientCredentials.value, "type")._visit({
                                    referencedEndpoint: (referencedEndpoint) => (
                                        <FoundOAuthReferencedEndpointForm
                                            context={oauthReferencedContext || context}
                                            referencedEndpoint={referencedEndpoint}
                                            disabled={disabled}
                                            lang={lang}
                                        />
                                    ),
                                    _other: () => false
                                }),
                            _other: () => false
                        });
                    }
                    return false;
                },
                _other: () => false
            })}
        </ul>
    );
};
