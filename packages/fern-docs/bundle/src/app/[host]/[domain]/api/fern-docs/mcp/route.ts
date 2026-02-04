import { getMetadata } from "@fern-api/docs-loader";
import { createGetAuthStateEdge } from "@fern-api/docs-server/auth/getAuthStateEdge";
import { HEADER_X_FERN_BASEPATH } from "@fern-api/docs-utils";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "@/components/util/randomUUID";

function createMcpServer(domain: string, basepath: string): McpServer {
    const server = new McpServer(
        {
            name: "fern-docs-mcp-server",
            version: "1.0.0"
        },
        {
            capabilities: {
                tools: {}
            }
        }
    );

    server.tool(
        "searchDocs",
        "Search the documentation for relevant information.",
        {
            query: z.string().describe("The search query to run against the docs")
        },
        async ({ query }) => {
            try {
                // Construct base URL with basepath for sites hosted at subpaths (e.g., buildwithfern.com/learn)
                const baseUrl = basepath === "/" ? `https://${domain}` : `https://${domain}${basepath}`;
                const url = `${baseUrl}/api/fern-docs/search/v2/chat`;

                const algoliaSearchKey = await fetch(`${baseUrl}/api/fern-docs/search/v2/key`);
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
                    conversationId: randomUUID(),
                    queryId: randomUUID(),
                    filters: [],
                    documentUrls: [],
                    source: "MCP",
                    id: randomUUID(),
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

    return server;
}

async function handleMcpRequest(req: NextRequest, domain: string): Promise<Response> {
    await getMetadata({
        kvTtl: 0,
        forceRevalidate: false,
        cacheKeySuffix: ""
    })(domain);

    // Get basepath from header set by middleware (defaults to "/" if not set)
    const basepath = req.headers.get(HEADER_X_FERN_BASEPATH) ?? "/";

    const server = createMcpServer(domain, basepath);
    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);

    return transport.handleRequest(req);
}

async function isAuthed(req: NextRequest): Promise<boolean> {
    const { getAuthState } = await createGetAuthStateEdge(req);
    const authState = await getAuthState(req.nextUrl.pathname);
    return !!authState.ok;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ host: string; domain: string }> }) {
    const { domain } = await params;

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
    return handleMcpRequest(request, domain);
}

export async function POST(request: NextRequest, props: { params: Promise<{ host: string; domain: string }> }) {
    const { domain } = await props.params;
    const authed = await isAuthed(request);
    if (!authed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleMcpRequest(request, domain);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ host: string; domain: string }> }) {
    const authed = await isAuthed(request);
    if (!authed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { domain } = await params;
    return handleMcpRequest(request, domain);
}
