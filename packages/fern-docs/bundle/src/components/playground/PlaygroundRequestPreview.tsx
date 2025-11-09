"use client";

import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { FernSyntaxHighlighter } from "@fern-docs/components/syntax-highlighter";
import { useAtom, useAtomValue } from "jotai";
import { type FC, useMemo } from "react";

import {
    PLAYGROUND_AUTH_STATE_ATOM,
    PLAYGROUND_AUTH_STATE_OAUTH_ATOM,
    PLAYGROUND_SELECTED_AUTH_TYPE_ATOM
} from "@/state/playground";

import { PlaygroundCodeSnippetResolverBuilder } from "./code-snippets/resolver";
import { useSnippet } from "./code-snippets/useSnippet";
import type { PlaygroundEndpointRequestFormState } from "./types";
import { getAuthKey } from "./utils";
import { usePlaygroundBaseUrl } from "./utils/select-environment";

interface PlaygroundRequestPreviewProps {
    context: EndpointContext;
    formState: PlaygroundEndpointRequestFormState;
    requestType: "curl" | "typescript" | "python";
}

export const PlaygroundRequestPreview: FC<PlaygroundRequestPreviewProps> = ({ context, formState, requestType }) => {
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    const [oAuthValue, setOAuthValue] = useAtom(PLAYGROUND_AUTH_STATE_OAUTH_ATOM);
    const selectedAuthType = useAtomValue(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);
    const [baseUrl] = usePlaygroundBaseUrl(context.endpoint, context.node.apiDefinitionId);

    // Determine which auth to use based on the selected auth type, and get its key
    const { selectedAuth, authKey } = useMemo(() => {
        if (context.authsWithKeys.length === 0) {
            return { selectedAuth: undefined, authKey: undefined };
        }

        // If a specific auth type is selected, find it
        if (selectedAuthType) {
            const selectedAuthWithKey = context.authsWithKeys.find(
                (authWithKey) => getAuthKey(authWithKey) === selectedAuthType
            );
            if (selectedAuthWithKey) {
                return {
                    selectedAuth: selectedAuthWithKey.scheme,
                    authKey: getAuthKey(selectedAuthWithKey)
                };
            }
        }

        // Default to the first auth
        const firstAuth = context.authsWithKeys[0];
        return {
            selectedAuth: firstAuth?.scheme,
            authKey: firstAuth ? getAuthKey(firstAuth) : undefined
        };
    }, [context.authsWithKeys, selectedAuthType]);

    const builder = useMemo(() => new PlaygroundCodeSnippetResolverBuilder(context, true), [context]);

    const resolver = useMemo(
        () => oAuthValue && builder.createRedacted(authState, formState, baseUrl, setOAuthValue, selectedAuth, authKey),
        [authState, builder, formState, oAuthValue, baseUrl, setOAuthValue, selectedAuth, authKey]
    );
    const code = useSnippet(resolver, requestType);

    return (
        <FernSyntaxHighlighter
            className="relative min-h-0 flex-1 shrink select-text"
            language={requestType === "curl" ? "bash" : requestType}
            code={code}
            fontSize="sm"
            id={context.endpoint.id}
        />
    );
};
