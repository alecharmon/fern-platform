import { getMetadata } from "@fern-api/docs-loader";
import { createGetAuthStateEdge } from "@fern-api/docs-server/auth/getAuthStateEdge";
import { createMcpHandler } from "mcp-handler";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type McpHandler = ReturnType<typeof createMcpHandler> extends Promise<infer U>
    ? U
    : ReturnType<typeof createMcpHandler>;

async function createHandler(host: string, domain: string): Promise<McpHandler> {
    await getMetadata({
        kvTtl: 0,
        forceRevalidate: false,
        cacheKeySuffix: ""
    })(domain);

    const mcpHandler = await createMcpHandler(
        async (server) => {
            server.tool(
                "searchDocs",
                "Search the documentation for relevant information.",
                {
                    query: z.string().describe("The search query to run against the docs")
                },
                async ({ query }) => {
                    try {
                        const url = `http://${domain}/api/fern-docs/search/v2/chat`;

                        const algoliaSearchKey = await fetch(`http://${domain}/api/fern-docs/search/v2/key`);
                        if (!algoliaSearchKey.ok) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `Failed to fetch search key: ${algoliaSearchKey.statusText}`
                                    }
                                ]
                            };
                        }

                        const algoliaSearchKeyJson = await algoliaSearchKey.json();

                        if (algoliaSearchKeyJson === null) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `[Expected] search disabled`
                                    }
                                ]
                            };
                        }

                        const body = JSON.stringify({
                            algoliaSearchKey: algoliaSearchKeyJson?.apiKey ?? "",
                            url: "MCP",
                            conversationId: crypto.randomUUID(),
                            queryId: crypto.randomUUID(),
                            filters: [],
                            documentUrls: [],
                            source: "MCP",
                            id: crypto.randomUUID(),
                            messages: [
                                {
                                    role: "user",
                                    parts: [
                                        {
                                            type: "text",
                                            text: query
                                        }
                                    ],
                                    id: "user-query"
                                }
                            ],
                            trigger: "submit-user-message"
                        });

                        const res = await fetch(url, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body
                        });

                        if (!res.ok) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `Search failed: ${res.statusText}`
                                    }
                                ]
                            };
                        }

                        if (!res.body) {
                            throw new Error("[MCP] Upstream response has no body for SSE stream");
                        }

                        let answer = "";
                        const reader = res.body.getReader();
                        const decoder = new TextDecoder();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) {
                                break;
                            }
                            answer += decoder.decode(value, { stream: true });
                        }

                        return {
                            content: [
                                {
                                    type: "text",
                                    text: answer || "No answer found."
                                }
                            ]
                        };
                    } catch (error) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Search failed: ${error instanceof Error ? error.message : String(error)}`
                                }
                            ]
                        };
                    }
                }
            );
        },
        {
            capabilities: {
                tools: {
                    searchDocs: {
                        description: "Search the documentation for relevant information."
                    }
                }
            }
        },
        {
            streamableHttpEndpoint: "/_mcp/server",
            verboseLogs: true,
            maxDuration: 60,
            disableSse: true
        }
    );
    return mcpHandler;
}

async function isAuthed(req: NextRequest): Promise<boolean> {
    const { getAuthState } = await createGetAuthStateEdge(req);
    const authState = await getAuthState(req.nextUrl.pathname);
    return !!authState.ok;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ host: string; domain: string }> }) {
    const { host, domain } = await params;

    const contentType = request.headers.get("content-type");
    const acceptHeader = request.headers.get("accept");
    const hasJsonRpcParams =
        request.nextUrl.searchParams.has("method") ||
        request.nextUrl.searchParams.has("jsonrpc") ||
        contentType?.includes("application/json");

    if (!hasJsonRpcParams && !acceptHeader?.includes("application/json")) {
        const url = `https://${domain}`;
        return new NextResponse(`This is an mcp server for ${url}`, {
            status: 200,
            headers: {
                "Content-Type": "text/plain"
            }
        });
    }

    const authed = await isAuthed(request);
    if (!authed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const handler = await createHandler(host, domain);
    return handler(request);
}

export async function POST(request: NextRequest, props: { params: Promise<{ host: string; domain: string }> }) {
    const { host, domain } = await props.params;
    const authed = await isAuthed(request);
    if (!authed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const handler = await createHandler(host, domain);
    const response = await handler(request);
    return response;
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ host: string; domain: string }> }) {
    const authed = await isAuthed(request);
    if (!authed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { host, domain } = await params;
    const handler = await createHandler(host, domain);
    return handler(request);
}
