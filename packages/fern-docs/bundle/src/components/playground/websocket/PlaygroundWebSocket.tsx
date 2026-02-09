"use client";

import type { WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import { buildRequestUrl, type WebSocketMessage } from "@fern-api/fdr-sdk/api-definition";
import { FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { t } from "@fern-docs/i18n";
import { usePrevious } from "@fern-ui/react-commons";
import { useAtomValue } from "jotai";
import { Wifi, WifiOff } from "lucide-react";
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import urlJoin from "url-join";
import {
    PLAYGROUND_AUTH_STATE_ATOM,
    PLAYGROUND_SELECTED_AUTH_TYPE_ATOM,
    usePlaygroundWebsocketFormState
} from "@/state/playground";

import { PlaygroundEndpointPath } from "../endpoint/PlaygroundEndpointPath";
import { getWebSocketProxyUrl } from "../fetch-utils/proxyUrl";
import { useWebsocketMessages } from "../hooks/useWebsocketMessages";
import { buildAuthHeaders, getAuthKey } from "../utils";
import { useFilteredEnvironments, usePlaygroundBaseUrl } from "../utils/select-environment";
import { PlaygroundWebSocketContent } from "./PlaygroundWebSocketContent";

interface PlaygroundWebSocketProps {
    context: WebSocketContext;
    authForm: React.ReactNode;
    lang: string;
}

export const PlaygroundWebSocket: FC<PlaygroundWebSocketProps> = ({ context, authForm, lang }) => {
    const [formState, setFormState] = usePlaygroundWebsocketFormState(context);
    const websocketMessageLimit = context.node.playground?.["limit-websocket-messages-per-connection"];
    const selectedAuthType = useAtomValue(PLAYGROUND_SELECTED_AUTH_TYPE_ATOM);
    const authState = useAtomValue(PLAYGROUND_AUTH_STATE_ATOM);
    // Use a ref to always have access to the latest authState in the callback
    const authStateRef = useRef(authState);
    authStateRef.current = authState;

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

    const [connectedState, setConnectedState] = useState<"opening" | "opened" | "closed">("closed");
    const { pushMessage, clearMessages } = useWebsocketMessages(context.node.id);
    const [error, setError] = useState<string | null>(null);
    const [activeSessionMessageCount, setActiveSessionMessageCount] = useState(0);

    const socket = useRef<WebSocket | null>(null);

    // close the socket when the websocket changes
    const prevWebsocket = usePrevious(context.node);
    useEffect(() => {
        if (prevWebsocket.id !== context.node.id) {
            socket.current?.close();
            setError(null);
        }
    }, [context.node.id, prevWebsocket.id]);

    // auto-destroy the socket when the component is unmounted
    useEffect(() => () => socket.current?.close(), []);

    // when we get to 20 messages, close the socket
    useEffect(() => {
        if (websocketMessageLimit && activeSessionMessageCount >= websocketMessageLimit) {
            socket.current?.close();
            setConnectedState("closed");
            pushMessage({
                type: "end",
                data: {
                    type: "json",
                    data: t(lang).ai.endOfSampleSession
                },
                origin: "endSample",
                displayName: undefined
            });
        }
    }, [activeSessionMessageCount, pushMessage, websocketMessageLimit, lang]);

    const settings = context.node.playground;

    const [baseUrl, environmentId] = usePlaygroundBaseUrl(context.channel, context.node.apiDefinitionId);

    // Filter environments by both PlaygroundSettings.environments (explicit allow list)
    // and audience matching (environment.audiences vs user.roles)
    const filteredEnvironments = useFilteredEnvironments(context.channel.environments, settings?.environments);

    const startSession = useCallback(async () => {
        return new Promise<boolean>((resolve) => {
            if (socket.current != null && socket.current.readyState !== WebSocket.CLOSED) {
                resolve(true);
                return;
            }

            setError(null);

            const url = buildRequestUrl({
                baseUrl,
                path: context.channel.path,
                pathParameters: formState.pathParameters,
                queryParameters: formState.queryParameters
            });

            setConnectedState("opening");

            socket.current = new WebSocket(urlJoin(getWebSocketProxyUrl(), url));

            socket.current.onopen = () => {
                const authHeaders = buildAuthHeaders(
                    selectedAuth,
                    authStateRef.current,
                    {
                        redacted: false
                    },
                    undefined,
                    authKey
                );
                const headers = {
                    ...authHeaders,
                    ...formState.headers
                };

                socket.current?.send(JSON.stringify({ type: "handshake", url, headers }));

                setConnectedState("opened");
                resolve(true);
            };

            socket.current.onmessage = (event) => {
                function maybeParsedData() {
                    try {
                        return JSON.parse(event.data);
                    } catch {
                        return event.data;
                    }
                }

                if (!websocketMessageLimit || activeSessionMessageCount < websocketMessageLimit) {
                    pushMessage({
                        type: "received",
                        data: {
                            type: "json",
                            data: maybeParsedData()
                        },
                        origin: "server",
                        displayName: undefined
                    });
                    setActiveSessionMessageCount((m) => m + 1);
                }
            };

            socket.current.onclose = (ev) => {
                setConnectedState("closed");
                resolve(false);

                if (ev.code !== 1000) {
                    setError(ev.reason);
                }
                setActiveSessionMessageCount(0);
            };

            socket.current.onerror = (event) => {
                console.error(`[playground-websocket] ${JSON.stringify(event)}`);
            };
        });
    }, [
        baseUrl,
        context.channel.path,
        selectedAuth,
        formState.pathParameters,
        formState.queryParameters,
        formState.headers,
        pushMessage,
        activeSessionMessageCount,
        websocketMessageLimit,
        authKey
    ]);

    const handleSendMessage = useCallback(
        async (message: WebSocketMessage, data: unknown) => {
            const isConnected = await startSession();
            if (isConnected && socket.current != null && socket.current.readyState === WebSocket.OPEN) {
                // TODO: handle validation
                socket.current.send(JSON.stringify(data));
                pushMessage({
                    type: message.type,
                    data: {
                        type: "json",
                        data
                    },
                    origin: "client",
                    displayName: message.displayName
                });
            }
        },
        [pushMessage, startSession]
    );

    return (
        <FernTooltipProvider>
            <div className="flex h-full min-h-0 flex-1 shrink flex-col">
                <div className="flex-0">
                    <PlaygroundEndpointPath
                        method={undefined}
                        formState={formState}
                        sendRequest={() => {
                            void (async () => {
                                if (connectedState === "closed") {
                                    await startSession();
                                } else if (connectedState === "opened") {
                                    socket.current?.close();
                                }
                            })();
                        }}
                        environmentId={environmentId}
                        baseUrl={baseUrl}
                        options={filteredEnvironments}
                        path={context.channel.path}
                        queryParameters={context.channel.queryParameters}
                        sendRequestButtonLabel={
                            connectedState === "closed"
                                ? t(lang).buttons.connect
                                : connectedState === "opening"
                                  ? t(lang).playground.connecting
                                  : t(lang).buttons.disconnect
                        }
                        sendRequestIcon={
                            connectedState === "opening" ? null : connectedState === "opened" ? (
                                <WifiOff className="size-6 rotate-90" />
                            ) : (
                                <Wifi className="size-6 rotate-90" />
                            )
                        }
                        types={context.types}
                        apiDefinitionId={context.node.apiDefinitionId}
                        lang={lang}
                    />
                </div>
                <div className="flex min-h-0 flex-1 shrink">
                    <PlaygroundWebSocketContent
                        context={context}
                        formState={formState}
                        setFormState={setFormState}
                        sendMessage={(message, data) => {
                            void handleSendMessage(message, data);
                        }}
                        startSesssion={() => {
                            void startSession();
                        }}
                        clearMessages={clearMessages}
                        connected={connectedState === "opened"}
                        error={error}
                        authForm={authForm}
                        lang={lang}
                    />
                </div>
            </div>
        </FernTooltipProvider>
    );
};
