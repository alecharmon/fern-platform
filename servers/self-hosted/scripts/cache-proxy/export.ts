/**
 * Static site export: crawls all pages to warm the cache, then dumps
 * the cache into a tar.gz that can be uploaded to S3 (or any static file host).
 *
 * The export runs in the background so the HTTP request returns immediately.
 * Callers poll GET /__cache/export/status until complete, then download via
 * GET /__cache/export/download.
 *
 * The export includes:
 * - All cached HTML pages mapped to file paths (e.g., /docs/intro -> docs/intro/index.html)
 * - Next.js static assets (_next/static/) from the build directory
 */

import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { log } from "./logger";
import { cache } from "./lru-cache";
import { runWarmup } from "./warmup";

const NEXTJS_STATIC_DIR = "/nextapp/packages/fern-docs/bundle/.next/static";
const EXPORT_OUTPUT_PATH = "/tmp/fern-static-export.tar.gz";

interface ExportedFile {
    path: string;
    content: Uint8Array;
}

/**
 * Decompress a cached response body based on its Content-Encoding header.
 * The proxy stores raw compressed bytes (decompress: false), so we need to
 * inflate them before writing to static files.
 */
function decompressBody(body: Uint8Array, headers: Headers): Uint8Array {
    const encoding = (headers.get("content-encoding") || "").toLowerCase();
    if (!encoding) {
        return body;
    }

    try {
        if (encoding === "gzip" || encoding === "x-gzip") {
            return new Uint8Array(gunzipSync(body));
        }
        if (encoding === "deflate") {
            return new Uint8Array(inflateSync(body));
        }
        if (encoding === "br") {
            return new Uint8Array(brotliDecompressSync(body));
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log("[export] WARNING: Failed to decompress (" + encoding + "): " + msg + ", using raw bytes");
    }

    return body;
}

// ── Background job state ──

interface ExportStatus {
    status: "idle" | "running" | "complete" | "failed";
    phase?: string;
    htmlPages?: number;
    staticAssets?: number;
    totalFiles?: number;
    archiveBytes?: number;
    durationMs?: number;
    error?: string;
}

let exportJob: ExportStatus = { status: "idle" };

function parseCacheKeyPath(cacheKey: string): string | null {
    // Cache key format: METHOD:isLoggedIn:roles:rsc:normalizedUrl
    // e.g., "GET:false:::/ " or "GET:false:::1:/docs/intro"
    const parts = cacheKey.split(":");
    if (parts.length < 5) {
        return null;
    }

    const method = parts[0];
    if (method !== "GET") {
        return null;
    }

    // RSC field is at index 3 — skip RSC entries (only export HTML)
    const rsc = parts[3];
    if (rsc === "1") {
        return null;
    }

    // URL path is everything after the 4th colon
    // Rejoin in case the URL itself contains colons
    const urlPath = parts.slice(4).join(":");
    return urlPath || null;
}

function urlPathToFilePath(urlPath: string): string {
    let cleaned = urlPath;

    // Strip leading slash
    if (cleaned.startsWith("/")) {
        cleaned = cleaned.substring(1);
    }

    // Strip query params
    const qIndex = cleaned.indexOf("?");
    if (qIndex !== -1) {
        cleaned = cleaned.substring(0, qIndex);
    }

    // Root path
    if (cleaned === "" || cleaned === "/") {
        return "index.html";
    }

    // If it already has an extension, keep it as-is
    const lastSegment = cleaned.split("/").pop() || "";
    if (lastSegment.includes(".")) {
        return cleaned;
    }

    // Otherwise treat as a directory path and add index.html
    return cleaned + "/index.html";
}

async function collectStaticFiles(dir: string, basePath: string): Promise<ExportedFile[]> {
    const files: ExportedFile[] = [];

    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch {
        return files;
    }

    for (const entry of entries) {
        // Skip macOS AppleDouble resource fork files
        if (entry.startsWith("._")) {
            continue;
        }

        const fullPath = join(dir, entry);
        const fileStat = await stat(fullPath);

        if (fileStat.isDirectory()) {
            const subFiles = await collectStaticFiles(fullPath, basePath);
            files.push(...subFiles);
        } else if (fileStat.isFile()) {
            const relativePath = relative(basePath, fullPath);
            const content = await Bun.file(fullPath).bytes();
            files.push({ path: "_next/static/" + relativePath, content: new Uint8Array(content) });
        }
    }

    return files;
}

/**
 * Create a tar.gz archive from a list of files.
 * Uses the tar utility via Bun.spawn for simplicity and reliability.
 */
async function createTarGz(files: ExportedFile[], outputPath: string): Promise<void> {
    const tmpDir = "/tmp/fern-static-export-staging";

    // Clean up any previous staging directory
    await Bun.spawn(["rm", "-rf", tmpDir]).exited;
    await Bun.spawn(["mkdir", "-p", tmpDir]).exited;

    // Write all files to the staging directory
    for (const file of files) {
        const filePath = join(tmpDir, file.path);
        const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
        await Bun.spawn(["mkdir", "-p", dirPath]).exited;
        await Bun.write(filePath, file.content);
    }

    // Create tar.gz from the staging directory
    const tarProc = Bun.spawn(["tar", "-czf", outputPath, "-C", tmpDir, "."], {
        stdout: "pipe",
        stderr: "pipe"
    });
    const tarExitCode = await tarProc.exited;
    if (tarExitCode !== 0) {
        const stderr = await new Response(tarProc.stderr).text();
        throw new Error("tar failed with exit code " + tarExitCode + ": " + stderr);
    }

    // Clean up staging directory
    await Bun.spawn(["rm", "-rf", tmpDir]).exited;
}

/**
 * Run the export in the background. Updates `exportJob` as it progresses.
 */
async function runExportJob(): Promise<void> {
    const startTime = Date.now();

    try {
        exportJob = { status: "running", phase: "warmup" };
        log("Starting static site export...");

        log("Running warmup to ensure all pages are cached...");
        const warmupResult = await runWarmup();
        log(
            "Warmup finished: " +
                warmupResult.htmlWarmed +
                " HTML pages, " +
                warmupResult.rscWarmed +
                " RSC pages warmed in " +
                warmupResult.durationMs +
                "ms"
        );

        exportJob = { status: "running", phase: "collecting" };

        const files: ExportedFile[] = [];
        let htmlCount = 0;
        let skippedCount = 0;

        for (const [key, entry] of cache.entries()) {
            const contentType = entry.headers.get("content-type") || "";
            const urlPath = parseCacheKeyPath(key);
            if (!urlPath) {
                log("[export] skip (non-page): key=" + key + " type=" + contentType + " status=" + entry.statusCode);
                skippedCount++;
                continue;
            }

            if (entry.statusCode !== 200) {
                log("[export] skip (status): key=" + key + " type=" + contentType + " status=" + entry.statusCode);
                skippedCount++;
                continue;
            }

            log("[export] include: key=" + key + " type=" + contentType + " status=" + entry.statusCode);
            const filePath = urlPathToFilePath(urlPath);
            const decompressed = decompressBody(entry.body, entry.headers);
            files.push({ path: filePath, content: decompressed });
            htmlCount++;
        }

        log("Collected " + htmlCount + " pages from cache (skipped " + skippedCount + " entries)");

        // Generate redirect pages for intermediate directories that don't have
        // their own index.html.  In the live app these paths redirect to the
        // first child page; we replicate that with a small HTML meta-refresh.
        //
        // Uses the navigation-ordered routes from warmup so that redirects point
        // to the correct first page (e.g., "overview" before "api-reference"),
        // not just whatever is alphabetically first.
        //
        // Process deepest directories first so that redirect files generated at
        // deeper levels become direct children for shallower levels.
        const existingPaths = new Set(files.map((f) => f.path));
        const parentDirs = new Set<string>();

        for (const filePath of existingPaths) {
            const parts = filePath.split("/");
            for (let i = 1; i < parts.length; i++) {
                parentDirs.add(parts.slice(0, i).join("/"));
            }
        }

        // Build a navigation-order index: for each file path, its position in
        // the warmup routes list.  Lower index = earlier in the navigation.
        const navOrder = new Map<string, number>();
        for (let i = 0; i < warmupResult.routes.length; i++) {
            const filePath = urlPathToFilePath(warmupResult.routes[i]);
            if (!navOrder.has(filePath)) {
                navOrder.set(filePath, i);
            }
        }

        function getNavPosition(filePath: string): number {
            return navOrder.get(filePath) ?? Number.MAX_SAFE_INTEGER;
        }

        // Sort deepest first so redirects cascade upward
        const sortedDirs = [...parentDirs].sort((a, b) => {
            const depthA = a.split("/").length;
            const depthB = b.split("/").length;
            return depthB - depthA;
        });

        let redirectCount = 0;
        for (const dir of sortedDirs) {
            const dirIndex = dir + "/index.html";
            if (existingPaths.has(dirIndex)) {
                continue;
            }

            // Find the direct child directory whose subtree contains the earliest
            // page in the navigation order.  This ensures "overview" (which contains
            // the first page) beats "api-reference" (alphabetically earlier but later
            // in the navigation).
            const directChildren = new Map<string, number>(); // childIndex path -> best nav order
            for (const filePath of existingPaths) {
                if (!filePath.startsWith(dir + "/") || !filePath.endsWith("/index.html")) {
                    continue;
                }
                const rest = filePath.slice(dir.length + 1);
                const childDirName = rest.split("/")[0];
                const childIndex = dir + "/" + childDirName + "/index.html";

                // Find the best (lowest) nav position of ANY descendant in this child subtree
                const order = getNavPosition(filePath);
                const current = directChildren.get(childIndex) ?? Number.MAX_SAFE_INTEGER;
                if (order < current) {
                    directChildren.set(childIndex, order);
                }
            }

            let firstChild: string | null = null;
            let firstChildOrder = Number.MAX_SAFE_INTEGER;
            for (const [childIndex, order] of directChildren) {
                if (
                    order < firstChildOrder ||
                    (order === firstChildOrder && (!firstChild || childIndex < firstChild))
                ) {
                    firstChild = childIndex;
                    firstChildOrder = order;
                }
            }

            if (!firstChild) {
                continue;
            }

            const childDir = firstChild.slice(dir.length + 1).replace(/\/index\.html$/, "");
            const absolutePath = "/" + dir + "/" + childDir + "/";
            const redirectHtml =
                '<!DOCTYPE html><html><head><meta charset="utf-8">' +
                '<meta http-equiv="refresh" content="0;url=' +
                absolutePath +
                '">' +
                '<link rel="canonical" href="' +
                absolutePath +
                '">' +
                "</head><body>" +
                '<p>Redirecting to <a href="' +
                absolutePath +
                '">' +
                absolutePath +
                "</a></p>" +
                "</body></html>";

            files.push({ path: dirIndex, content: new TextEncoder().encode(redirectHtml) });
            existingPaths.add(dirIndex);
            redirectCount++;
            log("[export] redirect: " + dirIndex + " -> " + absolutePath);
        }

        // Also generate a root index.html if missing
        if (!existingPaths.has("index.html")) {
            // Same subtree-based nav ordering for root
            const topDirs = new Map<string, number>();
            for (const filePath of existingPaths) {
                if (!filePath.endsWith("/index.html")) {
                    continue;
                }
                const topDirName = filePath.split("/")[0];
                const topIndex = topDirName + "/index.html";
                const order = getNavPosition(filePath);
                const current = topDirs.get(topIndex) ?? Number.MAX_SAFE_INTEGER;
                if (order < current) {
                    topDirs.set(topIndex, order);
                }
            }

            let firstTopLevel: string | null = null;
            let firstTopOrder = Number.MAX_SAFE_INTEGER;
            for (const [topIndex, order] of topDirs) {
                if (
                    order < firstTopOrder ||
                    (order === firstTopOrder && (!firstTopLevel || topIndex < firstTopLevel))
                ) {
                    firstTopLevel = topIndex;
                    firstTopOrder = order;
                }
            }

            if (firstTopLevel) {
                const topDir = firstTopLevel.replace(/\/index\.html$/, "");
                const absolutePath = "/" + topDir + "/";
                const redirectHtml =
                    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
                    '<meta http-equiv="refresh" content="0;url=' +
                    absolutePath +
                    '">' +
                    '<link rel="canonical" href="' +
                    absolutePath +
                    '">' +
                    "</head><body>" +
                    '<p>Redirecting to <a href="' +
                    absolutePath +
                    '">' +
                    absolutePath +
                    "</a></p>" +
                    "</body></html>";

                files.push({ path: "index.html", content: new TextEncoder().encode(redirectHtml) });
                redirectCount++;
                log("[export] redirect: index.html -> " + absolutePath);
            }
        }

        if (redirectCount > 0) {
            log("Generated " + redirectCount + " redirect pages for intermediate directories");
        }

        log("Collecting Next.js static assets from " + NEXTJS_STATIC_DIR + "...");
        const staticFiles = await collectStaticFiles(NEXTJS_STATIC_DIR, NEXTJS_STATIC_DIR);
        files.push(...staticFiles);
        log("Collected " + staticFiles.length + " static asset files");

        if (files.length === 0) {
            exportJob = { status: "failed", error: "No files to export. Warmup found no pages." };
            return;
        }

        exportJob = { status: "running", phase: "archiving", htmlPages: htmlCount, staticAssets: staticFiles.length };

        log("Creating tar.gz archive...");
        await createTarGz(files, EXPORT_OUTPUT_PATH);

        const archiveStat = await stat(EXPORT_OUTPUT_PATH);
        const durationMs = Date.now() - startTime;

        log(
            "Export complete: " +
                files.length +
                " files (" +
                htmlCount +
                " HTML pages, " +
                staticFiles.length +
                " static assets), " +
                (archiveStat.size / 1024 / 1024).toFixed(2) +
                " MB, " +
                durationMs +
                "ms"
        );

        exportJob = {
            status: "complete",
            htmlPages: htmlCount,
            staticAssets: staticFiles.length,
            totalFiles: files.length,
            archiveBytes: archiveStat.size,
            durationMs
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log("Export failed: " + msg);
        exportJob = { status: "failed", error: msg, durationMs: Date.now() - startTime };
    }
}

// ── HTTP handlers ──

/** POST /__cache/export — kick off the export (returns immediately) */
export function handleExportStart(req: Request): Response {
    if (req.method !== "POST") {
        return Response.json(
            {
                error: "Method not allowed. Use POST to trigger export.",
                usage: "curl -X POST http://localhost:3000/__cache/export"
            },
            { status: 405 }
        );
    }

    if (exportJob.status === "running") {
        return Response.json({ message: "Export already in progress", ...exportJob });
    }

    // Reset and kick off in the background
    exportJob = { status: "running", phase: "starting" };
    runExportJob().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        log("Export job unexpected error: " + msg);
        exportJob = { status: "failed", error: msg };
    });

    return Response.json({ message: "Export started", ...exportJob });
}

/** GET /__cache/export/status — poll for progress */
export function handleExportStatus(): Response {
    return Response.json(exportJob);
}

/** GET /__cache/export/download — download the archive once complete */
export async function handleExportDownload(): Promise<Response> {
    if (exportJob.status !== "complete") {
        return Response.json({ error: "Export not ready", status: exportJob.status }, { status: 409 });
    }

    const file = Bun.file(EXPORT_OUTPUT_PATH);
    const exists = await file.exists();
    if (!exists) {
        return Response.json({ error: "Archive file not found" }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();

    return new Response(bytes, {
        status: 200,
        headers: {
            "content-type": "application/gzip",
            "content-disposition": "attachment; filename=fern-static-export.tar.gz",
            "content-length": String(bytes.byteLength),
            "x-export-html-pages": String(exportJob.htmlPages ?? 0),
            "x-export-static-assets": String(exportJob.staticAssets ?? 0),
            "x-export-total-files": String(exportJob.totalFiles ?? 0),
            "x-export-duration-ms": String(exportJob.durationMs ?? 0)
        }
    });
}
