"use client";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { slugToHref } from "@fern-api/docs-utils";
import { cn } from "@fern-docs/components/cn";
import { useCurrentSlug } from "@fern-docs/components/hooks/use-current-pathname";
import { t } from "@fern-docs/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loading } from "./Loading";

export function WebSocketRefresh({ lang }: { lang: string }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [failedToLoad, setFailedToLoad] = useState(false);
    const [serverLoaded, setServerLoaded] = useState(false);
    const currentSlug = useCurrentSlug();
    const currentSlugRef = useRef<string | null>(currentSlug);

    useEffect(() => {
        currentSlugRef.current = currentSlug;
    }, [currentSlug]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: no dependencies needed
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
                            try {
                                const response = await fetch("/api/fern-docs/revalidate-local");
                                if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                router.refresh();

                                // Keep loading indicator visible for a bit longer to ensure
                                // the revalidation and router refresh complete
                                setTimeout(() => {
                                    setIsLoading(false);
                                }, 600);
                            } catch (error) {
                                console.error("Client: Failed to revalidate:", error);
                                setIsLoading(false);
                            }
                        }

                        // if we are currently on the old slug, navigate to the new slug
                        if (message.type === "navigateToSlug" && message.oldSlug === currentSlugRef.current) {
                            if (!message.newSlug) {
                                setIsLoading(false);
                                console.error("Client: No new slug found in navigateToSlug message");
                                return;
                            }

                            try {
                                router.replace(slugToHref(message.newSlug), { scroll: true });
                            } catch (error) {
                                console.error("Client: Failed to navigate to slug:", error);
                                setIsLoading(false);
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
                    <div className="text-(color:--red-a11) font-medium">{t(lang).errors.serverConnectionLost}</div>
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
                <Loading text={t(lang).status.reloading} />
            </div>
        </div>
    );
}
