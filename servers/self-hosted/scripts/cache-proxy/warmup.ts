/**
 * Cache warmup: crawls all pages to populate the LRU cache.
 *
 * Fetches the navigation tree from FDR (Fern Definition Registry) to discover
 * all page routes, then warms each route by requesting it through the proxy.
 */

import { DOCS_DOMAIN, FERN_AUTH_TYPE, PROXY_PORT } from "./config";
import { mintJWT } from "./jwt-utils";
import { log } from "./logger";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const PROXY_ORIGIN = `http://localhost:${PROXY_PORT}`;
const FDR_PORT = process.env.FDR_PORT || "8080";
const WARMUP_TIMEOUT_MS = 10_000;
const WARMUP_BATCH_SIZE = 2;
const WARMUP_BATCH_PAUSE_MS = 10;
const WARMUP_DELAY_MS = 10;

export interface WarmupResult {
    routes: string[];
    routesTotal: number;
    htmlWarmed: number;
    htmlFailed: number;
    rscWarmed: number;
    rscFailed: number;
    durationMs: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── FDR navigation tree types (minimal subset for route extraction) ──

interface FdrNavigationNode {
    type: string;
    slug?: string;
    default?: boolean;
    overviewPageId?: string;
    child?: FdrNavigationNode;
    children?: FdrNavigationNode[];
    landingPage?: FdrNavigationNode;
    nonStream?: FdrNavigationNode;
    stream?: FdrNavigationNode;
    changelog?: FdrNavigationNode;
}

/** Node types that represent visitable pages */
const PAGE_NODE_TYPES = new Set([
    "page",
    "landingPage",
    "changelogEntry",
    "endpoint",
    "webSocket",
    "webhook",
    "grpc",
    "graphql",
    "changelog"
]);

/** Node types that are visitable when they have an overviewPageId */
const SECTION_OVERVIEW_TYPES = new Set(["section", "apiReference", "apiPackage"]);

function getChildNodes(node: FdrNavigationNode): FdrNavigationNode[] {
    const children: FdrNavigationNode[] = [];
    if (node.landingPage) {
        children.push(node.landingPage);
    }
    if (node.child) {
        children.push(node.child);
    }
    if (node.children) {
        children.push(...node.children);
    }
    if (node.nonStream) {
        children.push(node.nonStream);
    }
    if (node.stream) {
        children.push(node.stream);
    }
    if (node.changelog) {
        children.push(node.changelog);
    }
    return children;
}

/**
 * Walk the root navigation tree and collect page slugs.
 *
 * Only descends into the default version node (if versioned), and strips
 * the version slug prefix so pages are collected at their canonical paths.
 */
function collectPageSlugsFromRootNode(root: FdrNavigationNode): string[] {
    const rootSlug = root.slug ?? "";
    let defaultVersionSlug: string | undefined;

    // First pass: find the default version slug (if any)
    function findDefaultVersion(node: FdrNavigationNode): void {
        if (node.type === "version" && node.default && node.slug) {
            defaultVersionSlug = node.slug;
            return;
        }
        for (const child of getChildNodes(node)) {
            findDefaultVersion(child);
            if (defaultVersionSlug != null) {
                return;
            }
        }
    }
    findDefaultVersion(root);

    const slugs: string[] = [];

    function walk(node: FdrNavigationNode): void {
        // Skip non-default version subtrees entirely
        if (node.type === "version" && !node.default) {
            return;
        }

        if (node.slug != null) {
            const isPage = PAGE_NODE_TYPES.has(node.type);
            const isSectionOverview = SECTION_OVERVIEW_TYPES.has(node.type) && node.overviewPageId != null;

            if (isPage || isSectionOverview) {
                let slug = node.slug;
                // For default version pages, strip version prefix to get canonical path
                if (defaultVersionSlug && slug.startsWith(defaultVersionSlug)) {
                    slug = rootSlug + slug.slice(defaultVersionSlug.length);
                    // Remove leading slash that may result from replacement
                    slug = slug.replace(/^\//, "");
                }
                slugs.push(slug);
            }
        }

        for (const child of getChildNodes(node)) {
            walk(child);
        }
    }

    walk(root);
    return slugs;
}

// ── Legacy navigation format types ──

interface LegacyNavigationItem {
    type: string;
    urlSlug?: string;
    fullSlug?: string[];
    skipUrlSlug?: boolean;
    items?: LegacyNavigationItem[];
    overviewPageId?: string;
    navigation?: { items?: LegacyNavigationItem[] };
}

interface LegacyNavigationTab {
    type: string;
    urlSlug?: string;
    skipUrlSlug?: boolean;
    items?: LegacyNavigationItem[];
}

interface LegacyNavigationConfig {
    versions?: Array<{ urlSlug?: string; config?: LegacyUnversionedConfig }>;
    tabs?: LegacyNavigationTab[];
    items?: LegacyNavigationItem[];
    landingPage?: { urlSlug?: string; fullSlug?: string[] };
}

interface LegacyUnversionedConfig {
    tabs?: LegacyNavigationTab[];
    items?: LegacyNavigationItem[];
    landingPage?: { urlSlug?: string; fullSlug?: string[] };
}

/**
 * Walk the legacy navigation config and build page paths.
 * Only processes the default (first) version if versioned.
 */
function collectPathsFromLegacyNavigation(navigation: LegacyNavigationConfig, basePath: string): string[] {
    const paths: string[] = [];

    function collectFromUnversioned(config: LegacyUnversionedConfig, currentPath: string): void {
        if (config.landingPage) {
            paths.push(currentPath || "/");
        }

        if (config.tabs) {
            for (const tab of config.tabs) {
                if (tab.type === "link") {
                    continue;
                }
                const tabPath = tab.skipUrlSlug || !tab.urlSlug ? currentPath : currentPath + "/" + tab.urlSlug;
                if (tab.items) {
                    for (const item of tab.items) {
                        collectFromItem(item, tabPath);
                    }
                }
            }
        } else if (config.items) {
            for (const item of config.items) {
                collectFromItem(item, currentPath);
            }
        }
    }

    function collectFromItem(item: LegacyNavigationItem, currentPath: string): void {
        switch (item.type) {
            case "page": {
                if (item.fullSlug) {
                    paths.push(basePath + "/" + item.fullSlug.join("/"));
                } else if (item.urlSlug) {
                    paths.push(currentPath + "/" + item.urlSlug);
                }
                break;
            }
            case "section": {
                const sectionPath = item.skipUrlSlug || !item.urlSlug ? currentPath : currentPath + "/" + item.urlSlug;
                if (item.overviewPageId) {
                    paths.push(sectionPath);
                }
                if (item.items) {
                    for (const child of item.items) {
                        collectFromItem(child, sectionPath);
                    }
                }
                break;
            }
            case "api":
            case "apiV2": {
                const apiPath = item.skipUrlSlug || !item.urlSlug ? currentPath : currentPath + "/" + item.urlSlug;
                paths.push(apiPath);
                if (item.navigation?.items) {
                    for (const child of item.navigation.items) {
                        collectFromItem(child, apiPath);
                    }
                }
                if (item.items) {
                    for (const child of item.items) {
                        collectFromItem(child, apiPath);
                    }
                }
                break;
            }
            case "changelog":
            case "changelogV3": {
                if (item.urlSlug) {
                    paths.push(currentPath + "/" + item.urlSlug);
                }
                break;
            }
            // "link" — external, skip
        }
    }

    if (navigation.versions && navigation.versions.length > 0) {
        // Only warm the default (first) version
        const defaultVersion = navigation.versions[0];
        if (defaultVersion.config) {
            collectFromUnversioned(defaultVersion.config, basePath);
        }
    } else {
        collectFromUnversioned(navigation as LegacyUnversionedConfig, basePath);
    }

    return paths;
}

// ── Main route fetching ──

async function fetchFdrRoutes(): Promise<string[]> {
    const domain = DOCS_DOMAIN || "localhost";

    log("[warmup] Fetching navigation from FDR for domain: " + domain);

    let data: {
        baseUrl?: { basePath?: string };
        definition?: {
            config?: {
                root?: FdrNavigationNode;
                navigation?: LegacyNavigationConfig;
            };
        };
    };

    try {
        const res = await fetch(`http://127.0.0.1:${FDR_PORT}/v2/registry/docs/load-with-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: domain }),
            signal: AbortSignal.timeout(30_000)
        });

        if (!res.ok) {
            log("[warmup] FDR returned HTTP " + res.status + ", falling back to root-only");
            return ["/"];
        }

        data = (await res.json()) as typeof data;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log("[warmup] Failed to fetch from FDR: " + msg + ", falling back to root-only");
        return ["/"];
    }

    const config = data?.definition?.config;

    // Try new format (root navigation tree with pre-computed slugs)
    if (config?.root) {
        log("[warmup] Using root navigation tree from FDR");
        const slugs = collectPageSlugsFromRootNode(config.root);
        const routes = [...new Set(slugs.map((s) => "/" + s).filter((r) => r !== "/"))];
        // Always include the root
        routes.unshift("/");
        log("[warmup] Found " + routes.length + " routes from FDR root node");
        return routes;
    }

    // Fall back to legacy navigation config
    if (config?.navigation) {
        log("[warmup] Using legacy navigation config from FDR");
        const basePath = data.baseUrl?.basePath ? "/" + data.baseUrl.basePath : BASE_PATH;
        const paths = collectPathsFromLegacyNavigation(config.navigation, basePath);
        const routes = [...new Set(paths)];

        if (routes.length === 0) {
            log("[warmup] No routes found in legacy navigation, falling back to root-only");
            return ["/"];
        }

        log("[warmup] Found " + routes.length + " routes from FDR legacy navigation");
        return routes;
    }

    log("[warmup] No navigation data in FDR response, falling back to root-only");
    return ["/"];
}

async function mintWarmupJWT(): Promise<string | null> {
    return mintJWT({ expiresInSeconds: 60 * 60 });
}

async function warmRoute(path: string, domain: string, rsc: boolean, authCookie?: string): Promise<boolean> {
    const fullUrl = `${PROXY_ORIGIN}${path}`;
    const headers: Record<string, string> = { "x-fern-host": domain };
    if (rsc) {
        headers["RSC"] = "1";
    }
    if (authCookie) {
        headers["cookie"] = "fern_token=" + authCookie;
    }

    try {
        const res = await fetch(fullUrl, {
            headers,
            redirect: "manual",
            signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS)
        });
        await res.arrayBuffer();

        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get("location");
            if (location) {
                const target = location.startsWith("http") ? location : PROXY_ORIGIN + location;
                const redirectRes = await fetch(target, {
                    headers,
                    redirect: "manual",
                    signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS)
                });
                await redirectRes.arrayBuffer();
                return redirectRes.status >= 200 && redirectRes.status < 300;
            }
        }

        return res.status >= 200 && res.status < 300;
    } catch {
        return false;
    }
}

async function warmRoutes(
    routes: string[],
    domain: string,
    label: string,
    authCookie?: string
): Promise<{ htmlWarmed: number; htmlFailed: number; rscWarmed: number; rscFailed: number }> {
    let htmlWarmed = 0;
    let htmlFailed = 0;
    let rscWarmed = 0;
    let rscFailed = 0;
    let batchCount = 0;

    for (const path of routes) {
        const htmlOk = await warmRoute(path, domain, false, authCookie);
        if (htmlOk) {
            htmlWarmed++;
        } else {
            htmlFailed++;
        }

        await sleep(WARMUP_DELAY_MS);

        const rscOk = await warmRoute(path, domain, true, authCookie);
        if (rscOk) {
            rscWarmed++;
        } else {
            rscFailed++;
        }

        batchCount++;

        await sleep(WARMUP_DELAY_MS);

        if (batchCount % WARMUP_BATCH_SIZE === 0) {
            const total = htmlWarmed + htmlFailed;
            log(
                "[warmup] " +
                    label +
                    " progress: " +
                    total +
                    "/" +
                    routes.length +
                    " (HTML: " +
                    htmlWarmed +
                    " ok/" +
                    htmlFailed +
                    " fail, RSC: " +
                    rscWarmed +
                    " ok/" +
                    rscFailed +
                    " fail)"
            );
            await sleep(WARMUP_BATCH_PAUSE_MS);
        }
    }

    return { htmlWarmed, htmlFailed, rscWarmed, rscFailed };
}

export async function runWarmup(): Promise<WarmupResult> {
    const startTime = Date.now();
    const domain = DOCS_DOMAIN || "localhost";

    log("[warmup] Starting cache warmup...");
    log("[warmup] Domain: " + domain);
    log("[warmup] Base path: " + (BASE_PATH || "(none)"));

    const routes = await fetchFdrRoutes();

    const authEnabled = !!FERN_AUTH_TYPE;
    let authCookie: string | null = null;

    if (authEnabled) {
        log("[warmup] Auth is enabled (type: " + FERN_AUTH_TYPE + "), minting JWT for authed warmup...");
        authCookie = await mintWarmupJWT();
        if (authCookie) {
            log("[warmup] JWT minted successfully, will warm both authed and unauthed pages");
        } else {
            log("[warmup] WARNING: Failed to mint JWT (no secret configured?), warming unauthed pages only");
        }
    }

    log("[warmup] Warming " + routes.length + " routes (HTML + RSC)");

    const unauthed = await warmRoutes(routes, domain, "unauthed");

    let authed = { htmlWarmed: 0, htmlFailed: 0, rscWarmed: 0, rscFailed: 0 };
    if (authCookie) {
        log("[warmup] Warming " + routes.length + " authed routes (HTML + RSC)");
        authed = await warmRoutes(routes, domain, "authed", authCookie);
    }

    const htmlWarmed = unauthed.htmlWarmed + authed.htmlWarmed;
    const htmlFailed = unauthed.htmlFailed + authed.htmlFailed;
    const rscWarmed = unauthed.rscWarmed + authed.rscWarmed;
    const rscFailed = unauthed.rscFailed + authed.rscFailed;
    const durationMs = Date.now() - startTime;

    log("[warmup] Warmup complete!");
    log("[warmup]   Total routes: " + routes.length);
    if (authCookie) {
        log(
            "[warmup]   Unauthed - HTML: " +
                unauthed.htmlWarmed +
                " ok/" +
                unauthed.htmlFailed +
                " fail, RSC: " +
                unauthed.rscWarmed +
                " ok/" +
                unauthed.rscFailed +
                " fail"
        );
        log(
            "[warmup]   Authed   - HTML: " +
                authed.htmlWarmed +
                " ok/" +
                authed.htmlFailed +
                " fail, RSC: " +
                authed.rscWarmed +
                " ok/" +
                authed.rscFailed +
                " fail"
        );
    } else {
        log("[warmup]   HTML warmed: " + htmlWarmed + " (failed: " + htmlFailed + ")");
        log("[warmup]   RSC warmed: " + rscWarmed + " (failed: " + rscFailed + ")");
    }
    log("[warmup]   Duration: " + durationMs + "ms");

    return {
        routes,
        routesTotal: routes.length,
        htmlWarmed,
        htmlFailed,
        rscWarmed,
        rscFailed,
        durationMs
    };
}
