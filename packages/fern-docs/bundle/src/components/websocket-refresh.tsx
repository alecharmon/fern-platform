"use client";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { cn } from "@fern-docs/components/cn";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Loading } from "./Loading";

export function WebSocketRefresh() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [failedToLoad, setFailedToLoad] = useState(false);
    const [serverLoaded, setServerLoaded] = useState(false);

    useEffect(() => {
        let ws: WebSocket | null = null;
        let connectionTimeout: NodeJS.Timeout | null = null;

        const setupWebSocket = async (): Promise<void> => {
            if (!isLocal()) {
                return;
            }

            if (typeof window === "undefined") {
                console.log("Not in browser environment, skipping WebSocket connection");
                setFailedToLoad(true);
                return;
            }

            if (typeof WebSocket === "undefined") {
                console.error("WebSocket is not available in this environment");
                setFailedToLoad(true);
                return;
            }

            // revalidate the page first to clear any cached content
            const revalidateResponse = await fetch("/api/fern-docs/revalidate-local");
            if (!revalidateResponse.ok) {
                setFailedToLoad(true);
                throw new Error(`HTTP error! status: ${revalidateResponse.status}`);
            }

            const envResponse = await fetch("/api/fern-docs/env-local");
            if (!envResponse.ok) {
                setFailedToLoad(true);
                throw new Error(`HTTP error! status: ${envResponse.status}`);
            }
            const data = await envResponse.json();

            if (!data.backendPort) {
                console.error("No port found in env-local response");
                setFailedToLoad(true);
                return;
            }

            const wsUrl = `ws://localhost:${data.backendPort}`;

            console.log(`Attempting to connect to WebSocket server at ${wsUrl}...`);

            try {
                ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    setIsLoading(false);
                    setServerLoaded(true);
                };

                ws.onmessage = async (event) => {
                    try {
                        const message = JSON.parse(event.data);

                        if (message.type === "startReload") {
                            setIsLoading(true);
                        }

                        if (message.type === "finishReload") {
                            setIsLoading(false);
                            try {
                                const response = await fetch("/api/fern-docs/revalidate-local");
                                if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                router.refresh();
                            } catch (error) {
                                console.error("Client: Failed to revalidate:", error);
                            }
                        }

                        if (message.type === "ping" && ws?.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "pong" }));
                        }
                    } catch (error) {
                        console.error("Client: Failed to parse WebSocket message:", error);
                    }
                };

                ws.onerror = (error) => {
                    console.error("Client: WebSocket error:", error);
                };

                ws.onclose = (event) => {
                    console.log(`Client: WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
                    setFailedToLoad(true);
                };

                connectionTimeout = setTimeout(() => {
                    if (ws?.readyState !== WebSocket.OPEN) {
                        console.error("Client: WebSocket connection failed to establish within 5 seconds");
                    }
                }, 5000);
            } catch (error) {
                console.error("Client: Failed to create WebSocket connection:", error);
                setFailedToLoad(true);
            }
        };

        void setupWebSocket();

        return () => {
            if (connectionTimeout) {
                clearTimeout(connectionTimeout);
            }
            if (ws) {
                ws.close();
                setFailedToLoad(true);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!isLocal()) {
        return null;
    }

    // if the server was loaded but has since failed, prompt to restart
    if (failedToLoad && serverLoaded) {
        return (
            <div className="animate-slide-down fixed left-1/2 top-0 z-50 -translate-x-1/2">
                <div className="rounded-3 border-border-default mt-6 border bg-white px-4 py-2 shadow-lg">
                    <div className="text-(color:--red-a11) font-medium">
                        Server connection lost, please refresh the page
                    </div>
                </div>
            </div>
        );
    }

    // otherwise, indicate loading
    return (
        <div
            className={cn(
                "fixed left-1/2 top-0 z-50 -translate-x-1/2",
                isLoading || failedToLoad ? "animate-slide-down" : "-translate-y-[150%]"
            )}
        >
            <div className="rounded-3 border-border-default mt-6 border bg-white px-4 py-2 shadow-lg">
                <Loading text="Reloading..." />
            </div>
        </div>
    );
}
