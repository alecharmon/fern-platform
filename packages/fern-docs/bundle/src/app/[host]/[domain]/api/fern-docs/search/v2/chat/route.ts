import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getFaiChatUrl } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const revalidate = 0;

export async function OPTIONS(_: NextRequest): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    });
}

async function proxyToFaiChat(req: NextRequest, domain: string, host: string): Promise<NextResponse> {
    const originalBodyText = await req.text();
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
        console.error("FAI chat proxy: failed to augment request with aiChatConfig", error);
    }

    try {
        const response = await fetch(getFaiChatUrl(), {
            method: "POST",
            headers: {
                "Content-Type": req.headers.get("content-type") ?? "application/json",
                "x-fern-host": domain
            },
            body: forwardedBody,
            cache: "no-store",
            signal: req.signal
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch from FAI chat service" }, { status: response.status });
        }

        if (!response.body) {
            return NextResponse.json({ error: "No response body from FAI chat service" }, { status: 500 });
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
        console.error("FAI chat proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("Ask Fern is not available in local preview mode or self-hosted mode", {
            status: 400
        });
    }

    const host = req.nextUrl.host;
    const domain = getDocsDomainEdge(req);

    return proxyToFaiChat(req, domain, host);
}
