import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes - site-to-docs may take a while for large sites

/**
 * Checks if a file is binary based on its extension
 */
function isBinaryFile(filePath: string): boolean {
    const binaryExtensions = new Set([
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".ico",
        ".bmp",
        ".webp",
        ".tiff",
        ".tif",
        ".pdf",
        ".zip",
        ".tar",
        ".gz",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".otf"
    ]);

    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.has(ext);
}

/**
 * Reads all files from a directory recursively
 */
async function readAllFilesFromDirectory(
    dirPath: string
): Promise<Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>> {
    const files: Array<{
        path: string;
        content: string;
        encoding?: "utf-8" | "base64";
    }> = [];

    const excludePatterns = [".git", "node_modules", ".DS_Store", ".cache"];

    async function readDir(currentPath: string, relativePath = "") {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            if (excludePatterns.includes(entry.name)) {
                continue;
            }

            const fullPath = path.join(currentPath, entry.name);
            const relPath = path.join(relativePath, entry.name);

            if (entry.isDirectory()) {
                await readDir(fullPath, relPath);
            } else {
                if (isBinaryFile(fullPath)) {
                    const buffer = await fs.readFile(fullPath);
                    files.push({
                        path: relPath,
                        content: buffer.toString("base64"),
                        encoding: "base64"
                    });
                } else {
                    const content = await fs.readFile(fullPath, "utf-8");
                    files.push({ path: relPath, content });
                }
            }
        }
    }

    await readDir(dirPath);
    return files;
}

export async function GET(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sourceUrl = searchParams.get("sourceUrl");
    const sessionId = searchParams.get("sessionId");

    if (!sourceUrl || !sessionId) {
        return new Response("Source URL and session ID required", { status: 400 });
    }

    // Validate URL
    try {
        const parsed = new URL(sourceUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return new Response("Invalid URL protocol", { status: 400 });
        }
    } catch {
        return new Response("Invalid URL", { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;

            const sendEvent = (data: { type: string; message: string; timestamp: string }) => {
                if (isClosed) {
                    return; // Don't send if controller is closed
                }
                try {
                    const message = `data: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(message));
                } catch {
                    // Controller may be closed, ignore the error
                    isClosed = true;
                }
            };

            let tempDir: string | null = null;

            try {
                sendEvent({
                    type: "log",
                    message: "Starting site-to-docs conversion...",
                    timestamp: new Date().toISOString()
                });

                // Create temporary directory in /tmp (Vercel serverless functions only allow writes to /tmp)
                tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "site-to-docs-"));

                sendEvent({
                    type: "log",
                    message: `Processing ${sourceUrl}`,
                    timestamp: new Date().toISOString()
                });

                // Import and run site-to-docs
                // Note: We use dynamic import to avoid bundling issues
                const { runAgent } = await import("@fern-api/site-to-docs");
                type ProgressEvent = import("@fern-api/site-to-docs").ProgressEvent;

                // Track last crawl/classify counts to avoid duplicate messages
                let lastCrawled = 0;
                let lastClassified = 0;
                let lastConverted = 0;

                // Run the agent with progress callback for real-time updates
                const result = await runAgent({
                    url: sourceUrl,
                    outputDir: tempDir,
                    organization: "placeholder", // Will be updated in setup
                    siteId: "placeholder", // Will be updated in setup
                    verbose: false, // Disable console logging, we'll use onProgress
                    maxPages: 128,
                    maxDepth: 8,
                    allowOutsideCwd: true, // Allow /tmp directory in serverless environments
                    onProgress: (event: ProgressEvent) => {
                        switch (event.stage) {
                            case "step":
                                sendEvent({
                                    type: "log",
                                    message: `[Step ${event.step}] ${event.message}`,
                                    timestamp: new Date().toISOString()
                                });
                                break;
                            case "crawl":
                                // Only send update if crawled count changed
                                if (event.crawled !== lastCrawled) {
                                    lastCrawled = event.crawled;
                                    sendEvent({
                                        type: "log",
                                        message: `  Crawled ${event.crawled} pages (${event.queued} in queue)`,
                                        timestamp: new Date().toISOString()
                                    });
                                }
                                break;
                            case "classify":
                                // Only send update if classified count changed
                                if (event.classified !== lastClassified) {
                                    lastClassified = event.classified;
                                    sendEvent({
                                        type: "log",
                                        message: `  Classified ${event.classified}/${event.total} pages`,
                                        timestamp: new Date().toISOString()
                                    });
                                }
                                break;
                            case "convert":
                                // Only send update if converted count changed
                                if (event.converted !== lastConverted) {
                                    lastConverted = event.converted;
                                    sendEvent({
                                        type: "log",
                                        message: `  Converted ${event.converted}/${event.total} pages to markdown`,
                                        timestamp: new Date().toISOString()
                                    });
                                }
                                break;
                        }
                    }
                });

                sendEvent({
                    type: "log",
                    message: `Conversion complete: ${result.writtenFiles.length} files written`,
                    timestamp: new Date().toISOString()
                });

                // Read all generated files
                sendEvent({
                    type: "log",
                    message: "Reading generated files...",
                    timestamp: new Date().toISOString()
                });

                const files = await readAllFilesFromDirectory(tempDir);

                // Log any warnings
                if (result.warnings.length > 0) {
                    sendEvent({
                        type: "log",
                        message: `Completed with ${result.warnings.length} warning(s)`,
                        timestamp: new Date().toISOString()
                    });
                }

                sendEvent({
                    type: "log",
                    message: "Conversion complete!",
                    timestamp: new Date().toISOString()
                });

                // Send completion event with all data
                sendEvent({
                    type: "complete",
                    message: JSON.stringify({
                        files,
                        sourceUrl,
                        pagesConverted: result.writtenFiles.filter((f) => f.endsWith(".mdx")).length,
                        totalFiles: result.writtenFiles.length,
                        warnings: result.warnings
                    }),
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error("Site-to-docs conversion failed:", error);
                sendEvent({
                    type: "error",
                    message: error instanceof Error ? error.message : "Unknown error occurred",
                    timestamp: new Date().toISOString()
                });
            } finally {
                // Mark as closed before cleanup to prevent any more events
                isClosed = true;

                // Cleanup temp directory
                if (tempDir) {
                    try {
                        await fs.rm(tempDir, { recursive: true, force: true });
                    } catch (cleanupError) {
                        console.error("Failed to cleanup temp directory:", cleanupError);
                    }
                }

                try {
                    controller.close();
                } catch {
                    // Controller may already be closed
                }
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
