"use client";

import type { EndpointContext, WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { useAtomValue } from "jotai";
import type React from "react";
import { type ReactElement, useMemo } from "react";
import { PLAYGROUND_SELECTED_AUTH_TYPE_ATOM } from "@/state/playground";

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

    // Determine which auth group to show based on the selected auth type
    const selectedAuthEntry = useMemo(() => {
        const entries =
            context.authOptionEntries.length > 0
                ? context.authOptionEntries
                : context.authsWithKeys.map((authWithKey) => ({
                      key: String(authWithKey.key),
                      schemeIds: [authWithKey.key],
                      schemes: [authWithKey.scheme],
                      label: String(authWithKey.key)
                  }));

        if (entries.length === 0) {
            return null;
        }

        // If a specific auth type is selected, find it
        if (selectedAuthType) {
            const entry = entries.find((e) => e.key === selectedAuthType);
            if (entry) {
                return entry;
            }
        }

        // Default to the first entry
        return entries[0];
    }, [context.authOptionEntries, context.authsWithKeys, selectedAuthType]);

    if (!selectedAuthEntry || selectedAuthEntry.schemes.length === 0) {
        return null;
    }

    const firstAuth = selectedAuthEntry.schemes[0];

    return (
        <PlaygroundAuthorizationFormCardRoot
            authIndex={authIndex}
            auth={firstAuth}
            totalAuthCount={totalAuthCount}
            allAuthTypes={allAuthTypes}
            allAuths={allAuths}
            authGroupSchemes={selectedAuthEntry.schemes}
        >
            {firstAuth && (
                <PlaygroundAuthorizationCardTrigger
                    key="trigger"
                    context={context}
                    auth={firstAuth}
                    oauthReferencedContext={oauthReferencedContext}
                    disabled={disabled}
                    lang={lang}
                    allAuths={allAuths}
                />
            )}
            <PlaygroundAuthorizationFormCardContent key="content">
                <div className="fern-dropdown max-h-full">
                    {selectedAuthEntry.schemes.map((auth, index) => {
                        const authKey = String(selectedAuthEntry.schemeIds[index]);

                        let oauthForm: React.ReactNode = null;
                        if (auth.type === "oAuth" && "endpoint" in context) {
                            oauthForm = visitDiscriminatedUnion(auth.value, "type")._visit({
                                clientCredentials: (clientCredentials) =>
                                    visitDiscriminatedUnion(clientCredentials.value, "type")._visit({
                                        referencedEndpoint: (referencedEndpoint) => {
                                            if (oauthReferencedContext) {
                                                return (
                                                    <ul key={index} className="list-none px-4">
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
                                                <ul key={index} className="list-none px-4">
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
                            oauthForm || (
                                <PlaygroundAuthorizationForm
                                    key={index}
                                    auth={auth}
                                    authKey={authKey}
                                    context={context}
                                    oauthReferencedContext={oauthReferencedContext}
                                    disabled={disabled}
                                    lang={lang}
                                />
                            )
                        );
                    })}
                    <div className="flex justify-end gap-2 p-4 pt-2">
                        {firstAuth?.type !== "oAuth" && <PlaygroundAuthorizationFormCardCloseButton lang={lang} />}
                        <PlaygroundAuthorizationFormCardResetButton lang={lang} />
                    </div>
                </div>
            </PlaygroundAuthorizationFormCardContent>
        </PlaygroundAuthorizationFormCardRoot>
    );
}
