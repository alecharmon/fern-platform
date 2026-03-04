/*eslint i18next/no-literal-string: off*/
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RevalidationState = "loading" | "failed";

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

export default function RootPage() {
    const [state, setState] = useState<RevalidationState>("loading");
    const [isLocalhost, setIsLocalhost] = useState(false);
    const attemptRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const attemptRevalidation = useCallback(async () => {
        const attempt = attemptRef.current + 1;
        console.log(`[revalidation] attempt ${attempt}/${MAX_RETRIES} — fetching /api/fern-docs/revalidate`);

        try {
            const response = await fetch("/api/fern-docs/revalidate", {
                signal: AbortSignal.timeout(30_000)
            });

            console.log(`[revalidation] response status: ${response.status}`);

            if (response.ok) {
                const body = await response.text();
                console.log(`[revalidation] response body: ${body}`);

                // The revalidation endpoint streams its progress. If the body contains
                // "revalidate-failed" with a 404, the site genuinely does not exist.
                if (body.includes("revalidate-failed") && body.includes("404")) {
                    console.log("[revalidation] site not found (404 in response), showing error");
                    setState("failed");
                    return;
                }

                // Revalidation succeeded — the site now exists and caches have been refreshed.
                // Perform a hard reload so the browser fetches the fresh server-rendered page
                // instead of continuing to show the stale "Host not found" client page.
                console.log("[revalidation] success, reloading page to show fresh content");
                window.location.reload();
                return;
            }

            throw new Error(`Revalidation returned status ${response.status}`);
        } catch (error) {
            attemptRef.current += 1;
            console.warn(`[revalidation] attempt ${attempt} failed:`, error);

            if (attemptRef.current >= MAX_RETRIES) {
                console.error(`[revalidation] all ${MAX_RETRIES} attempts exhausted, showing error`);
                setState("failed");
                return;
            }

            const backoff = INITIAL_BACKOFF_MS * 2 ** attemptRef.current;
            console.log(`[revalidation] retrying in ${backoff}ms`);
            timerRef.current = setTimeout(() => {
                void attemptRevalidation();
            }, backoff);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const hostname = window.location.hostname;
            const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
            setIsLocalhost(isLocal);

            if (isLocal) {
                setState("failed");
                return;
            }
        }

        void attemptRevalidation();

        return () => {
            if (timerRef.current != null) {
                clearTimeout(timerRef.current);
            }
        };
    }, [attemptRevalidation]);

    if (state === "loading") {
        return (
            <div
                style={{
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    textAlign: "center",
                    padding: "2rem",
                    backgroundColor: "#fafafa"
                }}
            >
                <div
                    style={{
                        width: "40px",
                        height: "40px",
                        border: "3px solid #e4e4e7",
                        borderTopColor: "#00C853",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite"
                    }}
                />
                <p style={{ color: "#71717a", fontSize: "1rem", marginTop: "1.5rem" }}>{"Loading..."}</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    console.error("Error: Host not found. Use /api/fern-docs/preview?host= to point this domain at a host.");

    return (
        <div
            style={{
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                textAlign: "center",
                padding: "2rem",
                backgroundColor: "#fafafa"
            }}
        >
            <div
                style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    padding: "3rem",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    maxWidth: "500px",
                    width: "100%"
                }}
            >
                <h1
                    style={{
                        marginBottom: "1rem",
                        color: "#18181b",
                        fontSize: "1.5rem",
                        fontWeight: 600
                    }}
                >
                    {"Host not found"}
                </h1>
                {isLocalhost ? (
                    <p
                        style={{
                            color: "#71717a",
                            fontSize: "1rem",
                            lineHeight: 1.6,
                            marginBottom: "1.5rem"
                        }}
                    >
                        {"Please restart the server."}
                    </p>
                ) : (
                    <>
                        <p
                            style={{
                                color: "#71717a",
                                fontSize: "1rem",
                                lineHeight: 1.6,
                                marginBottom: "1rem"
                            }}
                        >
                            {"The requested domain may not be configured yet."}
                        </p>
                        <p
                            style={{
                                color: "#71717a",
                                fontSize: "0.875rem",
                                lineHeight: 1.6,
                                marginBottom: "1.5rem"
                            }}
                        >
                            {"Learn how to "}{" "}
                            <a
                                href="https://buildwithfern.com/learn/docs/preview-publish/setting-up-your-domain"
                                style={{
                                    color: "#00C853",
                                    textDecoration: "none",
                                    fontWeight: 500
                                }}
                            >
                                {"set up your custom domain"}
                            </a>
                            {"."}
                        </p>
                    </>
                )}
                <p style={{ color: "#71717a", fontSize: "0.875rem" }}>
                    {"Need help? "}
                    <a
                        href="mailto:support@buildwithfern.com"
                        style={{
                            color: "#00C853",
                            textDecoration: "none",
                            fontWeight: 500
                        }}
                    >
                        {"Contact Fern support"}
                    </a>
                </p>
            </div>
        </div>
    );
}
