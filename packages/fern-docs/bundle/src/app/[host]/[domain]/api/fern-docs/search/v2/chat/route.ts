import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getFaiChatUrl } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN, HEADER_X_FERN_BASEPATH } from "@fern-api/docs-utils";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getBasepathRoutes } from "../../../../../../../../server/getBasepathRoutes";

export const maxDuration = 60;
export const revalidate = 0;

function getCorsHeaders(request: NextRequest): Record<string, string> {
    const origin = request.headers.get("Origin") ?? "*";
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "true"
    };
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(request)
    });
}

async function proxyToFaiChat(req: NextRequest, domain: string, host: string): Promise<NextResponse> {
    const originalBodyText = await req.text();
    let forwardedBody = originalBodyText;

    const cookieJar = await cookies();
    const fernToken = req.headers.get("FERN_TOKEN") ?? cookieJar.get(COOKIE_FERN_TOKEN)?.value;
    const basepath = req.headers.get(HEADER_X_FERN_BASEPATH);

    let matchingBasepaths: string[] | undefined;
    if (basepath) {
        const allBasepaths = await getBasepathRoutes(domain);
        if (allBasepaths) {
            matchingBasepaths = allBasepaths.filter((bp) => bp.startsWith(basepath));
        }
    }
    console.log("FAI chat proxy: basepath decision", {
        domain,
        basepath,
        matchingBasepaths,
        route: basepath ? "basepath-aware (filtering by matching basepaths)" : "default (no basepath filter)",
        headersSent: {
            "x-fern-host": domain,
            "x-fern-basepaths": matchingBasepaths ? "present" : "absent"
        }
    });

    try {
        const parsedBody = JSON.parse(originalBodyText || "{}");
        const loader = await createCachedDocsLoader(host, domain);
        const config = await loader.getConfig();
        const model = config.aiChatConfig?.model;
        const customerSystemPrompt = config.aiChatConfig?.systemPrompt;

        forwardedBody = JSON.stringify({
            ...parsedBody,
            model: model ?? parsedBody.model,
            customerSystemPrompt: customerSystemPrompt ?? parsedBody.customerSystemPrompt
        });
    } catch (error) {
        console.error("FAI chat proxy: failed to augment request with aiChatConfig", error);
    }

    try {
        const response = await fetch(getFaiChatUrl(), {
            method: "POST",
            headers: {
                "Content-Type": req.headers.get("content-type") ?? "application/json",
                "x-fern-host": domain,
                ...(fernToken ? { FERN_TOKEN: fernToken } : {}),
                ...(matchingBasepaths ? { "x-fern-basepaths": JSON.stringify(matchingBasepaths) } : {})
            },
            body: forwardedBody,
            cache: "no-store",
            signal: req.signal
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch from FAI chat service" },
                { status: response.status, headers: getCorsHeaders(req) }
            );
        }

        if (!response.body) {
            return NextResponse.json(
                { error: "No response body from FAI chat service" },
                { status: 500, headers: getCorsHeaders(req) }
            );
        }

        return new NextResponse(response.body, {
            status: response.status,
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "X-Accel-Buffering": "no",
                ...getCorsHeaders(req)
            }
        });
    } catch (error) {
        console.error("FAI chat proxy error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: getCorsHeaders(req) });
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
