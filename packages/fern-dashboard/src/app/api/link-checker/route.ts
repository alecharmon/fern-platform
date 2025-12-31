import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

import { runLinkChecker } from "./handler";
import type { LinkCheckProgress } from "./types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 480; // 8 minutes - link checking can be slow for large sites

export async function GET(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");

    if (!domain) {
        return new Response("Domain parameter is required", { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (event: LinkCheckProgress) => {
                const message = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            try {
                await runLinkChecker(domain, sendEvent);
            } catch (error) {
                sendEvent({
                    type: "error",
                    data: {
                        message: error instanceof Error ? error.message : "Unknown error occurred",
                        code: "UNKNOWN_ERROR"
                    },
                    timestamp: new Date().toISOString()
                });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
        }
    });
}
