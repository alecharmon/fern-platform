import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

import { checkLinksBatch, runLinkChecker, scrapePagesBatch } from "./handler";
import type { BatchCompleteData, LinkCheckProgress, ScrapeBatchCompleteData } from "./types";

export const maxDuration = 800; // Vercel enterprise max - batched approach keeps each request well under this

const HEARTBEAT_INTERVAL_MS = 15000; // Send heartbeat every 15 seconds to prevent idle timeout

/**
 * Validates that the domain parameter is a well-formed hostname (with optional path),
 * preventing SSRF attacks via IP addresses, port scanning, or URL manipulation.
 */
export function isValidDomain(domain: string): boolean {
    // Split domain and optional path (e.g. "docs.example.com/api")
    const [hostname, ...pathParts] = domain.split("/");

    if (!hostname) {
        return false;
    }

    // Block IP addresses (IPv4) and IPv6 addresses, and port specifications
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
        return false;
    }
    if (hostname.startsWith("[") || hostname.includes(":")) {
        return false;
    }

    // Must be a valid hostname: only alphanumeric, hyphens, and dots
    // Each label must start and end with alphanumeric, and the TLD must be at least 2 chars
    const hostnameRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!hostnameRegex.test(hostname)) {
        return false;
    }

    // Validate path parts if present (no empty segments, no path traversal)
    for (const part of pathParts) {
        if (part === ".." || part === "." || part === "") {
            return false;
        }
    }

    return true;
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
    const scrapeJobId = searchParams.get("scrapeJobId");

    if (!domain) {
        return new Response("Domain parameter is required", { status: 400 });
    }

    if (!isValidDomain(domain)) {
        return new Response("Invalid domain parameter", { status: 400 });
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
                    const result = await scrapePagesBatch(domain, scrapeJobId, sendEvent);
                    if (result.hasMore) {
                        const scrapeBatchData: ScrapeBatchCompleteData = {
                            scrapeJobId: result.scrapeJobId,
                            pagesScraped: result.totalPages,
                            totalPages: result.totalPages,
                            hasMore: true
                        };
                        sendEvent({
                            type: "scrape_batch_complete",
                            data: scrapeBatchData,
                            timestamp: new Date().toISOString()
                        });
                    }
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
