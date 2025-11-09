"use client";

import type { EndpointContext, WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { useAtomValue } from "jotai";
import type React from "react";
import { type ReactElement, useMemo } from "react";
import { PLAYGROUND_SELECTED_AUTH_TYPE_ATOM } from "@/state/playground";
import { getAuthKey } from "../utils";

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
    context: EndpointContext | WebSocketContext;
    oauthReferencedContext?: EndpointContext;
    disabled?: boolean;
    lang: string;
    authIndex?: number;
    totalAuthCount?: number;
    allAuthTypes?: string[];
    allAuths?: APIV1Read.ApiAuth[];
}
export function PlaygroundAuthorizationFormCard({
    context,
    oauthReferencedContext,
    disabled = false,
    lang,
    authIndex = 0,
    totalAuthCount = 1,
    allAuthTypes = [],
    allAuths = []
}: PlaygroundAuthorizationFormCardProps): ReactElement<any> | null {
    const selectedAuthType = useAtomValue(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);

    // Determine which auth to show based on the selected auth type, and get its key
    const { auth, authKey } = useMemo(() => {
        if (context.authsWithKeys.length === 0) {
            return { auth: undefined, authKey: undefined };
        }

        // If a specific auth type is selected, find it
        if (selectedAuthType) {
            const selectedAuthWithKey = context.authsWithKeys.find(
                (authWithKey) => getAuthKey(authWithKey) === selectedAuthType
            );
            if (selectedAuthWithKey) {
                return {
                    auth: selectedAuthWithKey.scheme,
                    authKey: getAuthKey(selectedAuthWithKey)
                };
            }
        }

        // Default to the first auth
        const firstAuth = context.authsWithKeys[0];
        return {
            auth: firstAuth?.scheme,
            authKey: firstAuth ? getAuthKey(firstAuth) : undefined
        };
    }, [context.authsWithKeys, selectedAuthType]);

    if (!auth || !authKey) {
        return null;
    }
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
        <PlaygroundAuthorizationFormCardRoot
            authIndex={authIndex}
            auth={auth}
            totalAuthCount={totalAuthCount}
            allAuthTypes={allAuthTypes}
            allAuths={allAuths}
        >
            <PlaygroundAuthorizationCardTrigger
                key="trigger"
                context={context}
                auth={auth}
                oauthReferencedContext={oauthReferencedContext}
                disabled={disabled}
                lang={lang}
                allAuths={allAuths}
            />
            <PlaygroundAuthorizationFormCardContent key="content">
                <div className="fern-dropdown max-h-full">
                    {oauthForm || (
                        <PlaygroundAuthorizationForm
                            auth={auth}
                            authKey={authKey}
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
