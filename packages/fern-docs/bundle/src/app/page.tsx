/*eslint i18next/no-literal-string: off*/
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RevalidationState = "streaming" | "success" | "failed";

interface Progress {
    completed: number;
    total: number;
    failed: number;
    errorRate: string;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _MONO_FONT = '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace';
const GREEN = "#00C853";
const GREEN_HOVER = "#00b84a";

const THEME_STYLES = `
    :root {
        --page-bg: #ffffff;
        --card-bg: #ffffff;
        --heading-color: #18181b;
        --text-color: #71717a;
        --text-muted: #a1a1aa;
        --border-color: #e4e4e7;
        --border-light: #f4f4f5;
        --terminal-header-bg: #fafafa;
        --terminal-bg: #18181b;
        --terminal-text: #d4d4d8;
        --terminal-muted: #52525b;
        --logo-text-fill: #18181b;
        --dot-bg: #e4e4e7;
    }
    @media (prefers-color-scheme: dark) {
        :root {
            --page-bg: #09090b;
            --card-bg: #18181b;
            --heading-color: #fafafa;
            --text-color: #a1a1aa;
            --text-muted: #71717a;
            --border-color: #27272a;
            --border-light: #27272a;
            --terminal-header-bg: #18181b;
            --terminal-bg: #09090b;
            --terminal-text: #d4d4d8;
            --terminal-muted: #52525b;
            --logo-text-fill: #fafafa;
            --dot-bg: #3f3f46;
        }
    }
    @keyframes blink { 50% { opacity: 0; } }
    .fern-logo-text { fill: var(--logo-text-fill); }
`;

function FernLogo() {
    return (
        <svg
            viewBox="0 0 604 164"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ height: "28px", width: "auto" }}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M295.294 0H255.861H255.836C234.047 0 221.437 11.4661 221.437 33.483V47.2372H193.242V75.2033H221.437V160.5H253.547V75.2033H288.404V47.2372H253.547V37.3728C253.547 30.7118 257.208 27.9661 263.87 27.9661H295.294V0ZM345.26 43.8081C311.777 43.8081 288.844 67.1979 288.844 103.198H288.87C288.87 139.884 311.802 163.96 346.43 163.96C375.311 163.96 392.727 149.291 399.388 126.816H366.591C363.591 133.02 356.955 137.367 346.633 137.367C331.277 137.367 321.87 129.562 320.497 115.35H400.761C401.219 110.545 401.447 106.401 401.447 102.283C401.447 66.2826 378.744 43.8081 345.26 43.8081ZM369.108 90.5877V91.0453H320.269C321.184 77.7487 329.675 69.0284 345.26 69.0284C360.845 69.0284 369.108 77.7487 369.108 90.5877ZM412.668 47.2321H440.863V67.1898C443.609 54.3508 452.787 47.2321 467.227 47.2321H487.414V51.122C487.414 64.4186 476.634 75.1982 463.338 75.1982C450.727 75.1982 444.753 81.6304 444.753 94.4694V160.52H412.642V47.2321H412.668ZM526.939 47.24H498.744H498.719V160.503H530.829V96.0789C530.829 81.6382 539.321 72.6891 552.16 72.6891C564.999 72.6891 571.889 80.0366 571.889 95.1637V160.528H604V91.7315C604 61.7061 586.559 43.8078 558.821 43.8078C545.753 43.8078 533.601 48.8417 526.939 58.7061V47.24Z"
                className="fern-logo-text"
            />
            <path
                d="M149.383 80.2222C138.594 71.101 122.341 67.4445 107.936 78.0925C107.273 78.5747 106.449 77.751 106.952 77.1081C110.367 72.7082 114.325 67.9668 117.519 63.2053C120.774 58.3233 125.636 54.8275 131.241 53.1198C161.076 44.079 152.116 0 152.116 0C152.116 0 106.027 2.97342 111.713 42.7329C112.657 49.3829 110.889 56.1535 106.731 61.4374C101.628 67.8865 95.7008 74.0543 91.4014 78.5144C90.4973 79.4386 88.9705 78.5546 89.3321 77.309C93.4909 63.3058 96.5246 41.648 82.1195 27.685L61.848 10.849L57.9504 15.9922C46.3581 31.2812 49.7534 52.8385 65.0625 64.4108C73.8422 71.0407 77.8201 78.2533 77.1973 86.169C76.8156 90.9104 74.6659 95.3505 71.4514 98.8663C65.4041 105.496 59.7586 112.608 55.3989 120.846C54.7962 121.991 53.0483 121.549 53.1086 120.243C53.7314 106.641 52.4255 75.983 29.5221 65.0336L3.88635 55.1289L1.89737 61.0556C-4.55174 80.182 5.99588 100.614 25.1021 107.104C41.7171 112.749 47.6439 123.457 43.6458 139.51C43.465 140.092 40.572 156.627 40.9738 163.96H59.3969C60.0198 152.589 71.9536 145.115 82.3003 149.756C85.2135 151.062 88.207 152.93 91.2809 155.341C107.755 168.32 132.025 165.246 144.983 148.752L148.68 144.05L125.375 127.315C109.383 114.738 88.0463 120.424 72.255 131.192C70.929 132.096 69.2414 130.65 69.9847 129.203C89.0709 91.7542 113.883 91.8346 123.607 100.152C135.4 110.238 153.261 108.429 163.266 96.5961L166.139 93.2007L149.363 80.2222H149.383Z"
                fill={GREEN}
            />
        </svg>
    );
}

export default function RootPage() {
    const [state, setState] = useState<RevalidationState>("streaming");
    const [_streamLines, setStreamLines] = useState<string[]>([]);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [isLocalhost, setIsLocalhost] = useState(false);
    const attemptRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const _logContainerRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll log container to bottom when new lines arrive (terminal commented out)
    const _scrollToBottom = useCallback(() => {
        if (_logContainerRef.current) {
            _logContainerRef.current.scrollTop = _logContainerRef.current.scrollHeight;
        }
    }, []);

    const attemptRevalidation = useCallback(async () => {
        const attempt = attemptRef.current + 1;
        console.log(`[revalidation] attempt ${attempt}/${MAX_RETRIES} — fetching /api/fern-docs/revalidate`);

        try {
            const response = await fetch("/api/fern-docs/revalidate", {
                signal: AbortSignal.timeout(300_000)
            });

            console.log(`[revalidation] response status: ${response.status}`);

            if (response.ok && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullBody = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    const chunk = decoder.decode(value, { stream: true });
                    fullBody += chunk;

                    // Split chunk into lines and parse them
                    const lines = chunk.split("\n").filter((line) => line.trim() !== "");
                    const displayLines: string[] = [];
                    for (const line of lines) {
                        // Parse progress lines into metrics
                        const progressMatch = line.match(
                            /revalidate-progress.*?completed=(\d+)\/(\d+);failed=(\d+);.*?errorRate=([\d.]+%)/
                        );
                        if (
                            progressMatch &&
                            progressMatch[1] != null &&
                            progressMatch[2] != null &&
                            progressMatch[3] != null &&
                            progressMatch[4] != null
                        ) {
                            setProgress({
                                completed: Number.parseInt(progressMatch[1], 10),
                                total: Number.parseInt(progressMatch[2], 10),
                                failed: Number.parseInt(progressMatch[3], 10),
                                errorRate: progressMatch[4]
                            });
                            continue;
                        }
                        // Parse revalidated URLs to show just the route
                        const revalidatedMatch = line.match(/revalidated.*?:https?:\/\/[^/]+(\/.*)/);
                        if (revalidatedMatch?.[1] != null) {
                            displayLines.push(revalidatedMatch[1]);
                            continue;
                        }
                        // Show other lines as-is
                        displayLines.push(line);
                    }
                    if (displayLines.length > 0) {
                        setStreamLines((prev) => [...prev, ...displayLines]);
                    }
                }

                console.log(`[revalidation] response body: ${fullBody}`);

                // The revalidation endpoint streams its progress. If the body contains
                // "revalidate-failed" with a 404, the site genuinely does not exist.
                if (fullBody.includes("revalidate-failed") && fullBody.includes("404")) {
                    console.log("[revalidation] site not found (404 in response), showing error");
                    setState("failed");
                    return;
                }

                // Revalidation succeeded — show a button to reload instead of auto-refreshing
                console.log("[revalidation] success, showing reload button");
                setState("success");
                return;
            }

            if (response.ok) {
                // Response OK but no body to stream — read as text fallback
                const body = await response.text();
                console.log(`[revalidation] response body: ${body}`);
                if (body.includes("revalidate-failed") && body.includes("404")) {
                    setState("failed");
                    return;
                }
                setState("success");
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
            setStreamLines((prev) => [...prev, `Retrying in ${backoff / 1000}s...`]);
            timerRef.current = setTimeout(() => {
                void attemptRevalidation();
            }, backoff);
        }
    }, []);

    // useEffect(() => {
    //     scrollToBottom();
    // });

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

    if (state === "streaming" || state === "success") {
        return (
            <div
                style={{
                    fontFamily: FONT_FAMILY,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    padding: "2rem",
                    backgroundColor: "var(--page-bg)"
                }}
            >
                <div style={{ marginBottom: "1.5rem" }}>
                    <FernLogo />
                </div>

                <h2
                    style={{
                        color: "var(--heading-color)",
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        marginBottom: "0.375rem",
                        letterSpacing: "-0.01em"
                    }}
                >
                    {state === "success" ? "Update Complete" : "Updating Site"}
                </h2>

                <p
                    style={{
                        color: "var(--text-color)",
                        fontSize: "0.875rem",
                        marginBottom: "1.25rem",
                        lineHeight: 1.5
                    }}
                >
                    {state === "success"
                        ? "Your site has been successfully updated."
                        : "Fetching the latest content and regenerating pages..."}
                </p>

                {/* Progress bar */}
                {progress && (
                    <div
                        style={{
                            maxWidth: "640px",
                            width: "100%",
                            marginBottom: "1rem"
                        }}
                    >
                        {/* <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.75rem",
                                color: "var(--text-color)",
                                marginBottom: "0.375rem",
                                fontFamily: MONO_FONT
                            }}
                        >
                            <span>
                                {progress.completed}
                                {"/"}
                                {progress.total}
                                {" pages"}
                            </span>
                            <span style={{ color: progress.failed > 0 ? "#f87171" : "var(--text-muted)" }}>
                                {progress.failed > 0 ? `${progress.failed} failed` : `error rate ${progress.errorRate}`}
                            </span>
                        </div> */}
                        <div
                            style={{
                                height: "6px",
                                backgroundColor: "var(--border-color)",
                                borderRadius: "3px",
                                overflow: "hidden"
                            }}
                        >
                            <div
                                style={{
                                    height: "100%",
                                    width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                                    backgroundColor: GREEN,
                                    borderRadius: "3px",
                                    transition: "width 0.3s ease"
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Terminal-style log viewer — commented out, showing only progress bar
                <div
                    style={{
                        backgroundColor: "var(--card-bg)",
                        borderRadius: "12px",
                        border: "1px solid var(--border-color)",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
                        maxWidth: "640px",
                        width: "100%",
                        overflow: "hidden"
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "0.75rem 1rem",
                            borderBottom: "1px solid var(--border-color)",
                            backgroundColor: "var(--terminal-header-bg)"
                        }}
                    >
                        <div
                            style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                backgroundColor: "var(--dot-bg)"
                            }}
                        />
                        <div
                            style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                backgroundColor: "var(--dot-bg)"
                            }}
                        />
                        <div
                            style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                backgroundColor: "var(--dot-bg)"
                            }}
                        />
                        <span
                            style={{
                                marginLeft: "0.5rem",
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                fontFamily: MONO_FONT
                            }}
                        >
                            {"build log"}
                        </span>
                    </div>

                    <div
                        ref={logContainerRef}
                        style={{
                            backgroundColor: "var(--terminal-bg)",
                            color: "var(--text-muted)",
                            fontFamily: MONO_FONT,
                            fontSize: "0.75rem",
                            lineHeight: "1.7",
                            padding: "1rem",
                            maxHeight: "320px",
                            overflow: "auto",
                            textAlign: "left",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all"
                        }}
                    >
                        {streamLines.length === 0 && state === "streaming" && (
                            <span style={{ color: "var(--terminal-muted)" }}>{"Processing content..."}</span>
                        )}
                        {streamLines.map((line, i) => (
                            <div
                                key={i}
                                style={{
                                    color: line.includes("failed")
                                        ? "#f87171"
                                        : line.startsWith("/")
                                          ? GREEN
                                          : "var(--terminal-text)",
                                    padding: "1px 0"
                                }}
                            >
                                <span
                                    style={{
                                        color: "var(--terminal-muted)",
                                        marginRight: "0.5rem",
                                        userSelect: "none"
                                    }}
                                >
                                    {"$"}
                                </span>
                                {line}
                            </div>
                        ))}
                        {state === "streaming" && (
                            <span
                                style={{
                                    display: "inline-block",
                                    width: "7px",
                                    height: "14px",
                                    backgroundColor: GREEN,
                                    animation: "blink 1s step-end infinite",
                                    verticalAlign: "text-bottom",
                                    marginLeft: "1px"
                                }}
                            />
                        )}
                    </div>
                </div>
                */}
                {state === "success" && (
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: "1.5rem",
                            padding: "0.625rem 1.75rem",
                            backgroundColor: GREEN,
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "background-color 0.15s ease",
                            fontFamily: FONT_FAMILY,
                            letterSpacing: "-0.01em"
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = GREEN_HOVER)}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
                    >
                        {"Reload Page"}
                    </button>
                )}
                <style>{THEME_STYLES}</style>
            </div>
        );
    }

    console.error("Error: Host not found. Use /api/fern-docs/preview?host= to point this domain at a host.");

    return (
        <div
            style={{
                fontFamily: FONT_FAMILY,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                textAlign: "center",
                padding: "2rem",
                backgroundColor: "var(--page-bg)"
            }}
        >
            <div style={{ marginBottom: "1.5rem" }}>
                <FernLogo />
            </div>

            <div
                style={{
                    backgroundColor: "var(--card-bg)",
                    borderRadius: "12px",
                    padding: "2.5rem",
                    border: "1px solid var(--border-color)",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
                    maxWidth: "460px",
                    width: "100%"
                }}
            >
                {isLocalhost ? (
                    <p
                        style={{
                            color: "var(--text-color)",
                            fontSize: "1.0625rem",
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
                                color: "var(--text-color)",
                                fontSize: "1.0625rem",
                                lineHeight: 1.6,
                                marginBottom: "0.75rem"
                            }}
                        >
                            {"This domain doesn't seem to be fully set up yet."}
                            <br />
                            {"It may take a few minutes after initial configuration."}
                        </p>
                        <p
                            style={{
                                color: "var(--text-color)",
                                fontSize: "0.9375rem",
                                lineHeight: 1.6,
                                marginBottom: "1.5rem"
                            }}
                        >
                            {"Learn how to "}{" "}
                            <a
                                href="https://buildwithfern.com/learn/docs/preview-publish/setting-up-your-domain"
                                style={{
                                    color: GREEN,
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
                <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "1rem" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                        {"Need help? "}
                        <a
                            href="mailto:support@buildwithfern.com"
                            style={{
                                color: GREEN,
                                textDecoration: "none",
                                fontWeight: 500
                            }}
                        >
                            {"Contact Fern support"}
                        </a>
                    </p>
                </div>
            </div>
            <style>{THEME_STYLES}</style>
        </div>
    );
}
