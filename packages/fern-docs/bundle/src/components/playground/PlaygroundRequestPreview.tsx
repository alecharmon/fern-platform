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

    const { selectedAuth, authKey, selectedAuthSchemes, selectedAuthKeys } = useMemo(() => {
        const authEntries =
            context.authOptionEntries.length > 0
                ? context.authOptionEntries
                : context.authsWithKeys.map((authWithKey) => ({
                      key: getAuthKey(authWithKey),
                      schemeIds: [authWithKey.key],
                      schemes: [authWithKey.scheme],
                      label: String(authWithKey.key)
                  }));

        if (authEntries.length === 0) {
            return {
                selectedAuth: undefined,
                authKey: undefined,
                selectedAuthSchemes: undefined,
                selectedAuthKeys: undefined
            };
        }

        let selectedEntry = authEntries[0];
        if (selectedAuthType) {
            const entry = authEntries.find((e) => e.key === selectedAuthType);
            if (entry) {
                selectedEntry = entry;
            }
        }

        return {
            selectedAuth: selectedEntry?.schemes[0],
            authKey: String(selectedEntry?.schemeIds[0]),
            selectedAuthSchemes: selectedEntry?.schemes,
            selectedAuthKeys: selectedEntry?.schemeIds?.map((id) => String(id))
        };
    }, [context.authOptionEntries, context.authsWithKeys, selectedAuthType]);

    const builder = useMemo(() => new PlaygroundCodeSnippetResolverBuilder(context, true), [context]);

    const resolver = useMemo(
        () =>
            oAuthValue &&
            builder.createRedacted(
                authState,
                formState,
                baseUrl,
                setOAuthValue,
                selectedAuth,
                authKey,
                selectedAuthSchemes,
                selectedAuthKeys
            ),
        [
            authState,
            builder,
            formState,
            oAuthValue,
            baseUrl,
            setOAuthValue,
            selectedAuth,
            authKey,
            selectedAuthSchemes,
            selectedAuthKeys
        ]
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
