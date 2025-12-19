"use client";

import type { DynamicIRsByLanguage } from "@fern-api/docs-server";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { buildEndpointUrl } from "@fern-api/fdr-sdk/api-definition";
import { unknownToString } from "@fern-api/ui-core-utils";
import { FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { failed, type Loadable, loaded, loading, notStartedLoading } from "@fern-ui/loadable";
import { useEventCallback, useIsMobile } from "@fern-ui/react-commons";
import { mapValues } from "es-toolkit/object";
import { useAtomValue, useSetAtom } from "jotai";
import { SendHorizonal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MOBILE_TAB_REQUEST = "0";
const MOBILE_TAB_RESPONSE = "1";

import {
    PLAYGROUND_AUTH_STATE_ATOM,
    PLAYGROUND_AUTH_STATE_OAUTH_ATOM,
    PLAYGROUND_SELECTED_AUTH_TYPE_ATOM,
    usePlaygroundEndpointFormState,
    useResolvedPlaygroundState
} from "@/state/playground";
import { track } from "../../analytics";
import { filterExamplesForExplorer } from "../../api-reference/endpoints/filterExamplesForExplorer";
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
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    // Use a ref to always have access to the latest authState in the callback
    const authStateRef = useRef(authState);
    authStateRef.current = authState;

    // Determine which auth schemes to use based on the selected auth type
    const { authSchemes, authKeys } = useMemo(() => {
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
            return { authSchemes: [], authKeys: [] };
        }

        // If a specific auth type is selected, find it
        let selectedEntry = authEntries[0];
        if (selectedAuthType) {
            const entry = authEntries.find((e) => e.key === selectedAuthType);
            if (entry) {
                selectedEntry = entry;
            }
        }

        return {
            authSchemes: selectedEntry?.schemes,
            authKeys: selectedEntry?.schemeIds.map((id) => String(id))
        };
    }, [context.authsWithKeys, context.authOptionEntries, selectedAuthType]);

    const [formState, setFormState] = usePlaygroundEndpointFormState(context);

    const { filteredExamples, indexMapping } = useMemo(
        () => filterExamplesForExplorer(context.endpoint.examples),
        [context.endpoint.examples]
    );

    const hasExamples = filteredExamples.length > 0;
    const [selectedExampleIndex, setSelectedExampleIndex] = useState<number | undefined>(hasExamples ? 0 : undefined);
    const didAutoSelectRef = useRef(false);

    useEffect(() => {
        if (hasExamples && !didAutoSelectRef.current) {
            didAutoSelectRef.current = true;
            const originalIndex = indexMapping[0];
            if (originalIndex !== undefined) {
                const example = context.endpoint.examples?.[originalIndex];
                setSelectedExampleIndex(0);
                setFormState(getInitialEndpointRequestFormStateWithExample(context, example, resolvedPlaygroundState));
            }
        }
    }, [hasExamples, indexMapping, context, setFormState, resolvedPlaygroundState]);

    const onSelectExample = useEventCallback((filteredIndex: number) => {
        const originalIndex = indexMapping[filteredIndex];
        if (originalIndex === undefined) {
            resetWithoutExample();
            return;
        }
        const example = context.endpoint.examples?.[originalIndex];
        setSelectedExampleIndex(filteredIndex);
        setFormState(getInitialEndpointRequestFormStateWithExample(context, example, resolvedPlaygroundState));
    });

    const resetWithoutExample = useEventCallback(() => {
        setSelectedExampleIndex(undefined);
        setFormState(getInitialEndpointRequestFormStateWithExample(context, undefined, resolvedPlaygroundState));
    });

    const [response, setResponse] = useState<Loadable<PlaygroundResponse>>(notStartedLoading());

    const isMobile = useIsMobile();
    const [mobileTab, setMobileTab] = useState<string>(MOBILE_TAB_REQUEST);

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

            let authHeaders: Record<string, string> = {};

            for (let i = 0; i < (authSchemes?.length ?? 0); i++) {
                const auth = authSchemes?.[i];
                const authKey = authKeys?.[i];
                const headers = buildAuthHeaders(
                    auth,
                    authStateRef.current,
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
                authHeaders = { ...authHeaders, ...headers };
            }

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
                const [res, stream] = await executeProxyStream(req, disableProxy);

                const time = Date.now();

                if (res.headers.get("content-type")?.includes("audio/")) {
                    const reader = stream.getReader();
                    const chunks: Uint8Array<ArrayBuffer>[] = [];

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            break;
                        }
                        const buffer = new ArrayBuffer(value.length);
                        const copy = new Uint8Array(buffer);
                        copy.set(value);
                        chunks.push(copy);
                    }

                    const audioBlob = new Blob(chunks, {
                        type: res.headers.get("content-type") || ""
                    });
                    const audioUrl = URL.createObjectURL(audioBlob);

                    const responseTime = Date.now() - time;
                    const responseSize = String(chunks.reduce((total, chunk) => total + chunk.length, 0));

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
                            time: responseTime,
                            size: responseSize
                        })
                    );

                    track("api_playground_request_received", {
                        endpointId: endpoint.id,
                        endpointName: node.title,
                        method: endpoint.method,
                        docsRoute: `/${node.slug}`,
                        responseStatus: res.status,
                        responseStatusText: res.statusText,
                        responseTime,
                        responseSize
                    });

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

                track("api_playground_request_received", {
                    endpointId: endpoint.id,
                    endpointName: node.title,
                    method: endpoint.method,
                    docsRoute: `/${node.slug}`,
                    responseStatus: res.status,
                    responseStatusText: res.statusText,
                    responseTime: Date.now() - time,
                    responseSize: String(result.length)
                });
            } else {
                const res = await executeProxyRest(req, disableProxy);
                setResponse(loaded(res));
                track("api_playground_request_received", {
                    endpointId: endpoint.id,
                    endpointName: node.title,
                    method: endpoint.method,
                    docsRoute: `/${node.slug}`,
                    responseStatus: res.response.status,
                    responseStatusText: res.response.statusText,
                    responseTime: res.time,
                    responseSize: res.size
                });
            }
        } catch (e) {
            // TODO: sentry

            console.error(
                "An unexpected error occurred while sending request to the proxy server. This is likely a bug, rather than a user error.",
                e
            );
            setResponse(failed(e));
        }
    }, [endpoint, node.title, node.slug, authSchemes, authKeys, formState, baseUrl, setOAuthValue, disableProxy]);

    const handleSendRequest = useCallback(async () => {
        try {
            await sendRequest();
        } finally {
            if (isMobile) {
                setMobileTab(MOBILE_TAB_RESPONSE);
            }
        }
    }, [sendRequest, isMobile]);

    const settings = node.playground;

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
                                    await handleSendRequest();
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
                        filteredExamples={filteredExamples}
                        selectedExampleIndex={selectedExampleIndex}
                        onSelectExample={onSelectExample}
                        resetWithoutExample={resetWithoutExample}
                        response={response}
                        sendRequest={() => {
                            void (async () => {
                                try {
                                    await handleSendRequest();
                                } catch (e) {
                                    console.error("Failed to send request:", e);
                                }
                            })();
                        }}
                        dynamicIRsByLanguage={dynamicIRsByLanguage}
                        lang={lang}
                        mobileTab={mobileTab}
                        onMobileTabChange={setMobileTab}
                    />
                </div>
            </div>
        </FernTooltipProvider>
    );
};
