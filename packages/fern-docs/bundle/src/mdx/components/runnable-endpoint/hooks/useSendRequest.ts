import { type AuthScheme, buildEndpointUrl, type EndpointDefinition } from "@fern-api/fdr-sdk/api-definition";
import { unknownToString } from "@fern-api/ui-core-utils";
import { failed, type Loadable, loaded, loading, notStartedLoading } from "@fern-ui/loadable";
import { mapValues } from "es-toolkit/object";
import { useAtomValue } from "jotai";
import { useCallback, useRef, useState } from "react";
import { executeProxyRest } from "@/components/playground/fetch-utils/executeProxyRest";
import type { PlaygroundEndpointRequestFormState, ProxyRequest } from "@/components/playground/types";
import type { PlaygroundResponse } from "@/components/playground/types/playgroundResponse";
import { buildAuthHeaders, serializeFormStateBody } from "@/components/playground/utils";
import { PLAYGROUND_AUTH_STATE_ATOM } from "@/state/playground";

interface UseSendRequestParams {
    endpoint: EndpointDefinition;
    formState: PlaygroundEndpointRequestFormState;
    baseUrl: string | undefined;
    authSchemes: AuthScheme[];
    disableProxy: boolean | undefined;
}

interface UseSendRequestReturn {
    response: Loadable<PlaygroundResponse>;
    sendRequest: () => Promise<void>;
    clearResponse: () => void;
}

export function useSendRequest({
    endpoint,
    formState,
    baseUrl,
    authSchemes,
    disableProxy
}: UseSendRequestParams): UseSendRequestReturn {
    const [response, setResponse] = useState<Loadable<PlaygroundResponse>>(notStartedLoading());
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    // Use a ref to always have access to the latest authState in the callback
    const authStateRef = useRef(authState);
    authStateRef.current = authState;

    const sendRequest = useCallback(async () => {
        setResponse(loading());
        try {
            // Get the first auth scheme (most common case)
            const auth = authSchemes[0];

            const authHeaders = buildAuthHeaders(
                auth,
                authStateRef.current,
                { redacted: false },
                {
                    formState,
                    endpoint,
                    baseUrl,
                    setValue: () => {
                        // No-op for runnable endpoint
                    }
                }
            );

            const headers = {
                ...authHeaders,
                ...mapValues(formState.headers ?? {}, (value) => unknownToString(value))
            };

            if (endpoint.method !== "GET" && endpoint.requests?.[0]?.contentType != null) {
                headers["Content-Type"] = endpoint.requests[0].contentType;
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
                    protocol: endpoint.protocol ?? undefined
                })
            };

            const res = await executeProxyRest(req, disableProxy);
            setResponse(loaded(res));
        } catch (e) {
            setResponse(failed(e));
        }
    }, [endpoint, formState, baseUrl, authSchemes, disableProxy]);

    const clearResponse = useCallback(() => {
        setResponse(notStartedLoading());
    }, []);

    return {
        response,
        sendRequest,
        clearResponse
    };
}
