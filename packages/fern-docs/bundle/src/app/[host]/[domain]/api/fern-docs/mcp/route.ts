import { getMetadata } from "@fern-api/docs-loader";
import { createGetAuthStateEdge } from "@fern-api/docs-server/auth/getAuthStateEdge";
import { createMcpHandler } from "mcp-handler";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Accepts host and domain, returns a handler
async function createHandler(host: string, domain: string) {
    const metadata = await getMetadata({
        kvTtl: 0,
        forceRevalidate: false,
        cacheKeySuffix: ""
    })(domain);

    return createMcpHandler(
        async (server) => {
            server.tool(
                `Search-${metadata.org}-Docs`,
                "Search the documentation for relevant information.",
                {
                    query: z.string().describe("The search query to run against the docs")
                },
                async ({ query }) => {
                    // Use host and domain from the closure
                    try {
                        console.log(`[MCP] SearchDocs called with query:`, query, `host:`, host, `domain:`, domain);

                        const url = `http://${domain}/api/fern-docs/search/v2/chat`;

                        const algoliaSearchKey = await fetch(`http://${domain}/api/fern-docs/search/v2/key`);
                        if (!algoliaSearchKey.ok) {
                            console.error(
                                `[MCP] Failed to fetch Algolia search key: ${algoliaSearchKey.status} ${algoliaSearchKey.statusText}`
                            );
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
                        // Build the body to respect the required structure, but use the incoming query as the latest user message
                        const body = JSON.stringify({
                            algoliaSearchKey: algoliaSearchKeyJson?.apiKey ?? "",
                            url: "MCP",
                            conversationId: crypto.randomUUID(),
                            queryId: crypto.randomUUID(),
                            filters: [],
                            documentUrls: [],
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

                        console.log(`[MCP] Fetching: ${url} with body: ${body}`);

                        const res = await fetch(url, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body
                        });

                        if (!res.ok) {
                            console.error(`[MCP] SearchDocs fetch failed: ${res.status} ${res.statusText}`);
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

                        // Parse the SSE stream and extract the final message
                        // Simple stream collector: iterate over each message and concat
                        let answer = "";
                        const reader = res.body.getReader();
                        const decoder = new TextDecoder();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
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
                        console.error(`[MCP] SearchDocs encountered an error:`, error);
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
            basePath: "",
            verboseLogs: true,
            maxDuration: 60,
            disableSse: false
        }
    );
}

/**
 * Helper function to check if the request is authenticated.
 * Accepts a NextRequest and returns a boolean indicating auth state.
 */
async function isAuthed(req: NextRequest): Promise<boolean> {
    const { getAuthState } = await createGetAuthStateEdge(req);
    const authState = await getAuthState(req.nextUrl.pathname);
    return !!authState.ok;
}

// Next.js route handlers for GET, POST, DELETE
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ host: string; domain: string }> }) {
    const authed = await isAuthed(request);
    if (!authed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { host, domain } = await params;
    const handler = await createHandler(host, domain);
    return handler(request);
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
