"use client";

import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { buildEndpointUrl } from "@fern-api/fdr-sdk/api-definition";
import { unknownToString } from "@fern-api/ui-core-utils";
import { FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { jotaiStore } from "@fern-docs/components/state/jotai-provider";
import { failed, type Loadable, loaded, loading, notStartedLoading } from "@fern-ui/loadable";
import { useEventCallback } from "@fern-ui/react-commons";
import { mapValues } from "es-toolkit/object";
import { useAtomValue, useSetAtom } from "jotai";
import { SendHorizonal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
    PLAYGROUND_AUTH_STATE_ATOM,
    PLAYGROUND_AUTH_STATE_OAUTH_ATOM,
    PLAYGROUND_SELECTED_AUTH_TYPE_ATOM,
    usePlaygroundEndpointFormState,
    useResolvedPlaygroundState
} from "@/state/playground";

import { track } from "../../analytics";
import { usePlaygroundSettings } from "../../hooks/usePlaygroundSettings";
import { executeProxyRest } from "../fetch-utils/executeProxyRest";
import { executeProxyStream } from "../fetch-utils/executeProxyStream";
import type { ProxyRequest } from "../types";
import type { PlaygroundResponse } from "../types/playgroundResponse";
import {
    buildAuthHeaders,
    getAuthKey,
    getInitialEndpointRequestFormStateWithExample,
    serializeFormStateBody
} from "../utils";
import { usePlaygroundBaseUrl } from "../utils/select-environment";
import { isLocal } from "../utils/utils";
import { PlaygroundEndpointContent } from "./PlaygroundEndpointContent";
import { PlaygroundEndpointPath } from "./PlaygroundEndpointPath";

export const PlaygroundEndpoint = ({
    context,
    authForm,
    dynamicIRsByLanguage,
    disableProxy,
    lang
}: {
    context: EndpointContext;
    authForm: React.ReactNode;
    dynamicIRsByLanguage: DynamicIRsByLanguage | undefined;
    disableProxy: boolean | undefined;
    lang: string;
}) => {
    const resolvedPlaygroundState = useResolvedPlaygroundState();
    const { node, endpoint } = context;
    const selectedAuthType = useAtomValue(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);

    // Determine which auth to use based on the selected auth type, and get its key
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

    const isDisableProxy = disableProxy || isLocal();

    const [formState, setFormState] = usePlaygroundEndpointFormState(context);

    const resetWithExample = useEventCallback(() => {
        setFormState(
            getInitialEndpointRequestFormStateWithExample(
                context,
                context.endpoint.examples?.[0],
                resolvedPlaygroundState
            )
        );
    });

    const resetWithoutExample = useEventCallback(() => {
        setFormState(getInitialEndpointRequestFormStateWithExample(context, undefined, resolvedPlaygroundState));
    });

    const [response, setResponse] = useState<Loadable<PlaygroundResponse>>(notStartedLoading());

    const [baseUrl, environmentId] = usePlaygroundBaseUrl(endpoint, node.apiDefinitionId);

    const setOAuthValue = useSetAtom(PLAYGROUND_AUTH_STATE_OAUTH_ATOM);

    const sendRequest = useCallback(async () => {
        if (endpoint == null) {
            return;
        }
        setResponse(loading());
        try {
            track("api_playground_request_sent", {
                endpointId: endpoint.id,
                endpointName: node.title,
                method: endpoint.method,
                docsRoute: `/${node.slug}`,
                endpointRoute: endpoint.path
                    .map((part) => (part.type === "pathParameter" ? `:${part.value}` : part.value))
                    .join("")
            });

            const authHeaders = buildAuthHeaders(
                auth,
                jotaiStore.get(PLAYGROUND_AUTH_STATE_ATOM),
                {
                    redacted: false
                },
                {
                    formState,
                    endpoint,
                    baseUrl,
                    setValue: setOAuthValue
                },
                authKey
            );
            const headers = {
                ...authHeaders,
                ...mapValues(formState.headers ?? {}, (value) => unknownToString(value))
            };

            if (endpoint.method !== "GET" && endpoint.requests?.[0]?.contentType != null) {
                headers["Content-Type"] = endpoint.requests[0].contentType;
            }

            // Add application/json content type for OpenRPC endpoints
            if (endpoint.protocol?.type === "openrpc") {
                headers["Content-Type"] = "application/json";
            }

            const req: ProxyRequest = {
                url: buildEndpointUrl({
                    endpoint,
                    pathParameters: formState.pathParameters,
                    queryParameters: formState.queryParameters,
                    baseUrl
                }),
                method: endpoint.method,
                headers,
                body: await serializeFormStateBody({
                    shape: endpoint.requests?.[0]?.body,
                    body: formState.body,
                    protocol: endpoint.protocol
                })
            };
            if (endpoint.responses?.[0]?.body.type === "stream") {
                const [res, stream] = await executeProxyStream(req, isDisableProxy);

                const time = Date.now();

                if (res.headers.get("content-type")?.includes("audio/")) {
                    const reader = stream.getReader();
                    const chunks: Uint8Array[] = [];

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                    }

                    const audioBlob = new Blob(chunks, {
                        type: res.headers.get("content-type") || ""
                    });
                    const audioUrl = URL.createObjectURL(audioBlob);

                    setResponse(
                        loaded({
                            type: "file",
                            response: {
                                headers: Object.fromEntries(res.headers.entries()),
                                ok: res.ok,
                                redirected: res.redirected,
                                status: res.status,
                                statusText: res.statusText,
                                type: res.type,
                                url: res.url,
                                body: audioUrl
                            },
                            contentType: res.headers.get("content-type") || "",
                            time: Date.now() - time,
                            size: String(chunks.reduce((total, chunk) => total + chunk.length, 0))
                        })
                    );

                    return;
                }

                const reader = stream.getReader();
                let result = "";
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    result += decoder.decode(value);
                    setResponse(
                        loaded({
                            type: "stream",
                            response: {
                                status: res.status,
                                body: result
                            },
                            time: Date.now() - time
                        })
                    );
                }
            } else {
                const res = await executeProxyRest(req, isDisableProxy);
                setResponse(loaded(res));
                if (res.type !== "stream") {
                    track("api_playground_request_received", {
                        endpointId: endpoint.id,
                        endpointName: node.title,
                        method: endpoint.method,
                        docsRoute: `/${node.slug}`,
                        response: {
                            status: res.response.status,
                            statusText: res.response.statusText,
                            time: res.time,
                            size: res.size
                        }
                    });
                }
            }
        } catch (e) {
            // TODO: sentry

            console.error(
                "An unexpected error occurred while sending request to the proxy server. This is likely a bug, rather than a user error.",
                e
            );
            setResponse(failed(e));
        }
    }, [endpoint, node.title, node.slug, auth, formState, baseUrl, setOAuthValue, isDisableProxy]);

    const settings = usePlaygroundSettings();

    return (
        <FernTooltipProvider>
            <div className="flex size-full min-h-0 flex-1 shrink flex-col">
                <div className="flex-0">
                    <PlaygroundEndpointPath
                        method={endpoint.method}
                        formState={formState}
                        sendRequest={() => {
                            void (async () => {
                                try {
                                    await sendRequest();
                                } catch (e) {
                                    console.error("Failed to send request:", e);
                                }
                            })();
                        }}
                        environmentId={environmentId}
                        baseUrl={baseUrl}
                        options={
                            settings?.environments
                                ? endpoint.environments?.filter(
                                      (env) => settings.environments?.includes(env.id) ?? true
                                  )
                                : endpoint.environments
                        }
                        path={endpoint.path}
                        queryParameters={endpoint.queryParameters}
                        sendRequestIcon={<SendHorizonal className="transition-transform group-hover:translate-x-0.5" />}
                        types={context.types}
                        apiDefinitionId={node.apiDefinitionId}
                        lang={lang}
                    />
                </div>
                <div className="flex min-h-0 flex-1 shrink">
                    <PlaygroundEndpointContent
                        authForm={authForm}
                        context={context}
                        formState={formState}
                        setFormState={setFormState}
                        resetWithExample={resetWithExample}
                        resetWithoutExample={resetWithoutExample}
                        response={response}
                        sendRequest={() => {
                            void (async () => {
                                try {
                                    await sendRequest();
                                } catch (e) {
                                    console.error("Failed to send request:", e);
                                }
                            })();
                        }}
                        dynamicIRsByLanguage={dynamicIRsByLanguage}
                        lang={lang}
                    />
                </div>
            </div>
        </FernTooltipProvider>
    );
};
