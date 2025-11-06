import "server-only";

import type { EndpointContext, WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import type React from "react";
import type { ReactElement } from "react";

import { PlaygroundAuthorizationForm } from "./PlaygroundAuthorizationForm";
import {
    PlaygroundAuthorizationCardTrigger,
    PlaygroundAuthorizationFormCardCloseButton,
    PlaygroundAuthorizationFormCardContent,
    PlaygroundAuthorizationFormCardResetButton,
    PlaygroundAuthorizationFormCardRoot
} from "./PlaygroundAuthorizationFormCardRoot";
import { PlaygroundBearerAuthForm } from "./PlaygroundBearerAuthForm";
import { FoundOAuthReferencedEndpointForm } from "./PlaygroundOAuthForm";

interface PlaygroundAuthorizationFormCardProps {
    auth: APIV1Read.ApiAuth;
    context: EndpointContext | WebSocketContext;
    oauthReferencedContext?: EndpointContext;
    disabled?: boolean;
    lang: string;
}
export function PlaygroundAuthorizationFormCard({
    auth,
    context,
    oauthReferencedContext,
    disabled = false,
    lang
}: PlaygroundAuthorizationFormCardProps): ReactElement<any> | null {
    let oauthForm: React.ReactNode = null;

    if (auth.type === "oAuth" && "endpoint" in context) {
        oauthForm = visitDiscriminatedUnion(auth.value, "type")._visit({
            clientCredentials: (clientCredentials) =>
                visitDiscriminatedUnion(clientCredentials.value, "type")._visit({
                    referencedEndpoint: (referencedEndpoint) => {
                        if (oauthReferencedContext) {
                            return (
                                <ul className="list-none px-4">
                                    <FoundOAuthReferencedEndpointForm
                                        context={oauthReferencedContext}
                                        referencedEndpoint={referencedEndpoint}
                                        disabled={disabled}
                                        lang={lang}
                                    />
                                </ul>
                            );
                        }
                        return (
                            <ul className="list-none px-4">
                                <PlaygroundBearerAuthForm
                                    bearerAuth={{ tokenName: "token", description: undefined }}
                                    disabled={disabled}
                                    lang={lang}
                                />
                            </ul>
                        );
                    },
                    _other: () => null
                }),
            _other: () => null
        });
    }

    return (
        <PlaygroundAuthorizationFormCardRoot>
            <PlaygroundAuthorizationCardTrigger
                context={context}
                auth={auth}
                oauthReferencedContext={oauthReferencedContext}
                disabled={disabled}
                lang={lang}
            />
            <PlaygroundAuthorizationFormCardContent>
                <div className="fern-dropdown max-h-full">
                    {oauthForm || (
                        <PlaygroundAuthorizationForm
                            auth={auth}
                            context={context}
                            oauthReferencedContext={oauthReferencedContext}
                            disabled={disabled}
                            lang={lang}
                        />
                    )}
                    <div className="flex justify-end gap-2 p-4 pt-2">
                        {auth.type !== "oAuth" && <PlaygroundAuthorizationFormCardCloseButton lang={lang} />}
                        <PlaygroundAuthorizationFormCardResetButton lang={lang} />
                    </div>
                </div>
            </PlaygroundAuthorizationFormCardContent>
        </PlaygroundAuthorizationFormCardRoot>
    );
}
