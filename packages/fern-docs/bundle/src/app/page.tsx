/*eslint i18next/no-literal-string: off*/
"use client";

import { useEffect, useState } from "react";

export default function RootPage() {
    const [isLocalhost, setIsLocalhost] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const hostname = window.location.hostname;
            setIsLocalhost(hostname === "localhost" || hostname === "127.0.0.1");
        }
    }, []);

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
