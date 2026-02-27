import { createCachedDocsLoader, createPruneKey } from "@fern-api/docs-loader";
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
 *
 * When multiple APIs exist and no `api` param is provided, returns a listing
 * of available APIs. When only one API exists, returns its spec directly.
 */
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { host, domain } = await props.params;
    const fernToken = req.headers.get("FERN_TOKEN") ?? (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

    const format = req.nextUrl.searchParams.get("format") ?? "json";
    const apiParam = req.nextUrl.searchParams.get("api");

    let loader;
    let root;

    try {
        loader = await createCachedDocsLoader(host, domain, fernToken);
        root = await loader.getRoot();
    } catch (error) {
        console.error(`[openapi:${domain}] Error loading docs:`, error);
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Collect all API reference nodes from the navigation tree
    const apiReferences = FernNavigation.utils.collectApiReferences(root);

    if (apiReferences.length === 0) {
        return NextResponse.json({ error: "No API definitions found" }, { status: 404 });
    }

    // If a specific API is requested, find it
    if (apiParam) {
        const apiRef = apiReferences.find((ref) => ref.apiDefinitionId === apiParam);
        if (!apiRef) {
            return NextResponse.json(
                {
                    error: `API definition '${apiParam}' not found`,
                    available: apiReferences.map((ref) => ({
                        id: ref.apiDefinitionId,
                        title: ref.title
                    }))
                },
                { status: 404 }
            );
        }

        return serveApiSpec(loader, apiRef, format, domain);
    }

    // If there's only one API, serve it directly
    if (apiReferences.length === 1 && apiReferences[0]) {
        return serveApiSpec(loader, apiReferences[0], format, domain);
    }

    // Multiple APIs: return a listing
    const apis = apiReferences.map((ref) => ({
        id: ref.apiDefinitionId,
        title: ref.title,
        slug: ref.slug
    }));

    return NextResponse.json(
        {
            apis,
            hint: "Multiple API definitions found. Use the ?api=<id> query parameter to retrieve a specific API's OpenAPI specification."
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
            }
        }
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
        return NextResponse.json({ error: "Failed to generate OpenAPI specification" }, { status: 500 });
    }
}
