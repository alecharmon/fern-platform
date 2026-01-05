import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

import { checkLinksBatch, runLinkChecker, scrapeAndStoreLinks } from "./handler";
import type { BatchCompleteData, LinkCheckProgress, ScrapeCompleteData } from "./types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // Vercel enterprise max - batched approach keeps each request well under this

const HEARTBEAT_INTERVAL_MS = 15000; // Send heartbeat every 15 seconds to prevent idle timeout

function generateJobId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function GET(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");
    const phase = searchParams.get("phase");
    const jobId = searchParams.get("jobId");

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

            const heartbeatInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": heartbeat\n\n"));
                } catch {
                    // Controller may be closed, ignore
                }
            }, HEARTBEAT_INTERVAL_MS);

            try {
                if (phase === "scrape") {
                    const newJobId = generateJobId();
                    const result = await scrapeAndStoreLinks(domain, newJobId, sendEvent);
                    const scrapeCompleteData: ScrapeCompleteData = {
                        jobId: newJobId,
                        totalPages: result.totalPages,
                        totalLinks: result.totalLinks
                    };
                    sendEvent({
                        type: "scrape_complete",
                        data: scrapeCompleteData,
                        timestamp: new Date().toISOString()
                    });
                } else if (phase === "check" && jobId) {
                    const result = await checkLinksBatch(jobId, sendEvent);
                    if (result.hasMore) {
                        const batchCompleteData: BatchCompleteData = {
                            jobId,
                            cursor: result.cursor,
                            hasMore: true
                        };
                        sendEvent({
                            type: "batch_complete",
                            data: batchCompleteData,
                            timestamp: new Date().toISOString()
                        });
                    }
                } else {
                    await runLinkChecker(domain, sendEvent);
                }
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
                clearInterval(heartbeatInterval);
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
