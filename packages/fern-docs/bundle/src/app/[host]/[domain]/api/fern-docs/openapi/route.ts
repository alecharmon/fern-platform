import { createCachedDocsLoader, createPruneKey } from "@fern-api/docs-loader";
import type { FernColorTheme } from "@fern-api/docs-utils";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import type { PruningNodeType } from "@fern-api/fdr-sdk/api-definition";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import yaml from "js-yaml";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { generateOpenApiSpec } from "@/server/generateOpenApiSpec";

/**
 * Serves raw OpenAPI specifications for API definitions in the docs.
 *
 * Query parameters:
 * - format: "json" (default) or "yaml"
 * - api: API definition ID to retrieve a specific API's spec (optional)
 * - title: API title to retrieve a specific API's spec (optional, normalized match)
 *
 * When multiple APIs exist and no `api` or `title` param is provided, returns a
 * human-readable listing of available APIs. When only one API exists, returns its spec directly.
 */
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { host, domain } = await props.params;
    const fernToken = req.headers.get("FERN_TOKEN") ?? (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

    const format = req.nextUrl.searchParams.get("format") ?? "json";
    // Read api param from search params or header (standalone mode doesn't support search params in rewrites)
    const apiParam = req.nextUrl.searchParams.get("api") ?? req.headers.get("x-fern-openapi-api");
    const titleParam = req.nextUrl.searchParams.get("title");

    let loader;
    let root;
    let colors: { light?: FernColorTheme; dark?: FernColorTheme } = {};

    try {
        loader = await createCachedDocsLoader(host, domain, fernToken);
        // Use unsafe_getFullRoot to get the complete navigation tree without auth filtering.
        // The OpenAPI spec should include ALL endpoints regardless of the requester's auth state.
        [root, colors] = await Promise.all([loader.unsafe_getFullRoot(), loader.getColors()]);
    } catch (error) {
        console.error(`[openapi:${domain}] Error loading docs:`, error);
        return htmlResponse("Not Found", "<p>Could not load docs for this domain.</p>", 404, colors);
    }

    const theme = resolveTheme(colors);

    // Collect all API reference nodes from the navigation tree
    const apiReferences = FernNavigation.utils.collectApiReferences(root);

    if (apiReferences.length === 0) {
        return htmlResponse("Not Found", "<p>No API definitions found for this site.</p>", 404, colors);
    }

    // If a specific API is requested by ID, find it
    if (apiParam) {
        const apiRef = apiReferences.find((ref) => ref.apiDefinitionId === apiParam);
        if (!apiRef) {
            return htmlResponse(
                "API Not Found",
                `<p>API definition <code>${escapeHtml(apiParam)}</code> not found.</p>` +
                    renderApiListing(apiReferences, theme, "Available APIs:"),
                404,
                colors
            );
        }

        return serveApiSpec(loader, apiRef, format, domain);
    }

    // If a specific API is requested by title, find it (normalized match)
    if (titleParam) {
        const normalizedTitle = titleParam.trim().toLowerCase();
        const matches = apiReferences.filter((ref) => ref.title.trim().toLowerCase() === normalizedTitle);

        if (matches.length === 0) {
            return htmlResponse(
                "API Not Found",
                `<p>No API found with title <code>${escapeHtml(titleParam)}</code>.</p>` +
                    renderApiListing(apiReferences, theme, "Available APIs:"),
                404,
                colors
            );
        }

        if (matches.length === 1 && matches[0]) {
            return serveApiSpec(loader, matches[0], format, domain);
        }

        // Multiple APIs share the same title — ask the user to use ?api=<id> instead
        return htmlResponse(
            "Multiple APIs Found",
            `<p>Multiple APIs match the title <code>${escapeHtml(titleParam)}</code>. ` +
                "Please use the <code>?api=&lt;id&gt;</code> query parameter to select one:</p>" +
                renderApiTable(matches, theme),
            200,
            colors
        );
    }

    // If there's only one API, serve it directly
    if (apiReferences.length === 1 && apiReferences[0]) {
        return serveApiSpec(loader, apiReferences[0], format, domain);
    }

    // Multiple APIs: return a human-readable listing
    return htmlResponse(
        "Available APIs",
        "<p>Multiple API definitions found. Select one to view its OpenAPI specification:</p>" +
            renderApiListing(apiReferences, theme),
        200,
        colors
    );
}

async function serveApiSpec(
    loader: Awaited<ReturnType<typeof createCachedDocsLoader>>,
    apiRef: FernNavigation.ApiReferenceNode,
    format: string,
    domain: string
): Promise<NextResponse> {
    try {
        // Collect all API leaf nodes from the navigation tree so getPrunedApi
        // includes all endpoints/webhooks/websockets instead of pruning everything.
        const pruneKeys: PruningNodeType[] = [];
        FernNavigation.traverseDF(apiRef, (node) => {
            if (FernNavigation.isApiLeaf(node)) {
                pruneKeys.push(createPruneKey(node));
            }
        });

        const apiDefinition = await loader.getPrunedApi(apiRef.apiDefinitionId, ...pruneKeys);

        const spec = generateOpenApiSpec(apiDefinition, {
            title: apiRef.title ?? undefined
        });

        if (format === "yaml" || format === "yml") {
            const yamlContent = yaml.dump(spec, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
                sortKeys: false
            });

            return new NextResponse(yamlContent, {
                status: 200,
                headers: {
                    "Content-Type": "application/x-yaml; charset=utf-8",
                    "Content-Disposition": "inline",
                    "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
                }
            });
        }

        // Default: JSON
        return NextResponse.json(spec, {
            status: 200,
            headers: {
                "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
            }
        });
    } catch (error) {
        console.error(`[openapi:${domain}] Error generating spec for ${apiRef.apiDefinitionId}:`, error);
        return htmlResponse("Error", "<p>Failed to generate OpenAPI specification.</p>", 500, {});
    }
}

// --- Theme helpers ---

interface ResolvedTheme {
    background: string;
    text: string;
    accent: string;
    codeBg: string;
    border: string;
    headerBg: string;
}

function resolveTheme(colors: { light?: FernColorTheme; dark?: FernColorTheme }): ResolvedTheme {
    // Prefer dark theme if available, otherwise light
    const palette = colors.dark ?? colors.light;
    const isDark = colors.dark != null;

    return {
        background: palette?.background ?? (isDark ? "#0a0a0a" : "#ffffff"),
        text: isDark ? "#e5e5e5" : "#1a1a1a",
        accent: palette?.accent ?? "#0366d6",
        codeBg: isDark ? "#1e1e1e" : "#f0f0f0",
        border: palette?.border ?? (isDark ? "#333333" : "#e0e0e0"),
        headerBg: isDark ? "#111111" : "#f8f8f8"
    };
}

// --- HTML response helpers ---

function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlResponse(
    title: string,
    body: string,
    status: number,
    colors: { light?: FernColorTheme; dark?: FernColorTheme }
): NextResponse {
    const t = resolveTheme(colors);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: ${t.text}; background: ${t.background}; line-height: 1.6; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    code { background: ${t.codeBg}; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid ${t.border}; }
    th { font-weight: 600; background: ${t.headerBg}; }
    a { color: ${t.accent}; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .btn { display: inline-block; padding: 6px 16px; border-radius: 6px; background: ${t.accent}; color: ${t.background}; font-weight: 500; font-size: 0.875rem; text-decoration: none; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.85; text-decoration: none; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`;

    return new NextResponse(html, {
        status,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
        }
    });
}

function renderApiTable(refs: FernNavigation.ApiReferenceNode[], theme: ResolvedTheme): string {
    const rows = refs
        .map(
            (ref) =>
                `<tr><td>${escapeHtml(ref.title)}</td><td><code>${escapeHtml(ref.apiDefinitionId)}</code></td><td><a class="btn" href="?api=${encodeURIComponent(ref.apiDefinitionId)}">View spec</a></td></tr>`
        )
        .join("\n");

    return `<table>
  <thead><tr><th>Title</th><th>API ID</th><th></th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function renderApiListing(refs: FernNavigation.ApiReferenceNode[], theme: ResolvedTheme, heading?: string): string {
    const rows = refs
        .map(
            (ref) =>
                `<tr><td>${escapeHtml(ref.title)}</td><td><code>${escapeHtml(ref.apiDefinitionId)}</code></td><td><a class="btn" href="?api=${encodeURIComponent(ref.apiDefinitionId)}">View spec</a></td></tr>`
        )
        .join("\n");

    return `${heading ? `<p><strong>${escapeHtml(heading)}</strong></p>` : ""}
<table>
  <thead><tr><th>Title</th><th>API ID</th><th></th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}
