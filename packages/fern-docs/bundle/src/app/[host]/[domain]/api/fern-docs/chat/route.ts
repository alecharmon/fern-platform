import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getChatLambdaUrl } from "@fern-api/docs-server/env-variables";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { type NextRequest, NextResponse } from "next/server";

export const revalidate = 0;
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
    const domain = getDocsDomainEdge(request);
    const host = request.nextUrl.host;

    const originalBodyText = await request.text();
    let forwardedBody = originalBodyText;

    try {
        const parsedBody = JSON.parse(originalBodyText || "{}");
        const loader = await createCachedDocsLoader(host, domain);
        const config = await loader.getConfig();
        const model = config.aiChatConfig?.model;
        const customerSystemPrompt = config.aiChatConfig?.systemPrompt;

        if (model != null || customerSystemPrompt != null) {
            forwardedBody = JSON.stringify({
                ...parsedBody,
                model: model,
                customerSystemPrompt: customerSystemPrompt
            });
        }
    } catch (error) {
        console.error("Chat proxy: failed to augment request with aiChatConfig", error);
    }

    try {
        const response = await fetch(getChatLambdaUrl(), {
            method: "POST",
            headers: {
                "Content-Type": request.headers.get("content-type") ?? "application/json",
                "x-fern-host": domain
            },
            body: forwardedBody,
            cache: "no-store",
            signal: request.signal
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch from chat service" }, { status: response.status });
        }

        if (!response.body) {
            return NextResponse.json({ error: "No response body from chat service" }, { status: 500 });
        }

        return new NextResponse(response.body, {
            status: response.status,
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "X-Accel-Buffering": "no"
            }
        });
    } catch (error) {
        console.error("Chat proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
