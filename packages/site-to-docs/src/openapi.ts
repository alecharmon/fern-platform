import { stringify } from "yaml";
import type { PageNode } from "./types.js";

/**
 * OpenAPI 3.0 specification structure (subset for stub generation).
 */
interface OpenApiSpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers?: Array<{ url: string; description?: string }>;
    paths: Record<string, Record<string, PathOperation>>;
    components?: {
        schemas?: Record<string, unknown>;
    };
}

interface PathOperation {
    summary: string;
    description?: string;
    operationId: string;
    tags?: string[];
    responses: Record<string, { description: string }>;
}

/**
 * Extracts potential endpoint info from an API reference page.
 * Tries to infer HTTP method and path from the page title/slug.
 */
interface EndpointInfo {
    method: string;
    path: string;
    summary: string;
    tag?: string;
    operationId: string;
}

/**
 * Extracts endpoint information from a page's title and slug.
 */
function extractEndpointInfo(page: PageNode): EndpointInfo | null {
    const title = page.title.toLowerCase();
    const slug = page.slug;

    // Try to detect HTTP method from title
    const methodPatterns: Record<string, RegExp> = {
        get: /\b(get|list|fetch|retrieve|read)\b/i,
        post: /\b(post|create|add|new|submit)\b/i,
        put: /\b(put|update|replace)\b/i,
        patch: /\b(patch|modify|partial)\b/i,
        delete: /\b(delete|remove|destroy)\b/i
    };

    let method = "get"; // Default to GET
    for (const [m, pattern] of Object.entries(methodPatterns)) {
        if (pattern.test(title)) {
            method = m;
            break;
        }
    }

    // Extract path from slug - convert slug segments to path parameters
    const slugParts = slug.split("/").filter(Boolean);

    // Skip common prefixes like "api-reference", "api", "reference"
    const pathParts = slugParts.filter(
        (part) => !["api-reference", "api", "reference", "endpoints", "docs"].includes(part.toLowerCase())
    );

    if (pathParts.length === 0) {
        return null;
    }

    // Convert to OpenAPI path format
    // e.g., "users/get-user" → "/users/{id}"
    // e.g., "plant/add-plant" → "/plant"
    const resourcePath = pathParts
        .map((part) => {
            // Remove action words to get the resource name
            const cleaned = part.replace(/^(get|list|create|update|delete|add|remove|fetch)-?/i, "").replace(/-/g, "_");
            return cleaned || part;
        })
        .join("/");

    const path = `/${resourcePath}`;

    // Extract tag from first meaningful path segment
    const tag = pathParts[0]?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Generate operation ID from slug
    const operationId = pathParts.join("_").replace(/-/g, "_");

    return {
        method,
        path,
        summary: page.title,
        tag,
        operationId
    };
}

/**
 * Generates a minimal OpenAPI 3.0 stub from API reference pages.
 *
 * @param apiPages - Pages classified as API reference
 * @param options - Optional configuration
 * @returns OpenAPI YAML string
 */
export function generateOpenApiStub(
    apiPages: PageNode[],
    options: {
        title?: string;
        version?: string;
        description?: string;
        serverUrl?: string;
    } = {}
): string {
    const {
        title = "API Reference",
        version = "1.0.0",
        description = "Auto-generated API stub from documentation",
        serverUrl
    } = options;

    const spec: OpenApiSpec = {
        openapi: "3.0.0",
        info: {
            title,
            version,
            description
        },
        paths: {}
    };

    if (serverUrl) {
        spec.servers = [{ url: serverUrl, description: "API Server" }];
    }

    // Track tags for organization
    const tags = new Set<string>();

    // Process each API page
    for (const page of apiPages) {
        const endpoint = extractEndpointInfo(page);
        if (!endpoint) {
            continue;
        }

        const { method, path, summary, tag, operationId } = endpoint;

        // Initialize path if not exists
        if (!spec.paths[path]) {
            spec.paths[path] = {};
        }

        // Add operation
        const operation: PathOperation = {
            summary,
            operationId,
            responses: {
                "200": { description: "Successful response" },
                "400": { description: "Bad request" },
                "401": { description: "Unauthorized" },
                "404": { description: "Not found" },
                "500": { description: "Internal server error" }
            }
        };

        if (tag) {
            operation.tags = [tag];
            tags.add(tag);
        }

        spec.paths[path][method] = operation;
    }

    // Add empty paths if no endpoints were extracted
    if (Object.keys(spec.paths).length === 0) {
        spec.paths["/placeholder"] = {
            get: {
                summary: "Placeholder endpoint",
                operationId: "placeholder",
                description: "This is a placeholder. Replace with actual API endpoints.",
                responses: {
                    "200": { description: "Successful response" }
                }
            }
        };
    }

    // Generate YAML
    const yaml = stringify(spec, {
        indent: 2,
        lineWidth: 120
    });

    return `# OpenAPI 3.0 Stub - Auto-generated from documentation\n# TODO: Replace with actual API specification\n\n${yaml}`;
}

/**
 * Generates a minimal OpenAPI stub when no API pages are available.
 */
export function generateEmptyOpenApiStub(title = "API Reference"): string {
    const spec: OpenApiSpec = {
        openapi: "3.0.0",
        info: {
            title,
            version: "1.0.0",
            description: "API specification placeholder. Replace with actual API definition."
        },
        paths: {
            "/health": {
                get: {
                    summary: "Health check",
                    operationId: "healthCheck",
                    responses: {
                        "200": { description: "Service is healthy" }
                    }
                }
            }
        }
    };

    const yaml = stringify(spec, { indent: 2, lineWidth: 120 });
    return `# OpenAPI 3.0 Stub\n# TODO: Replace with actual API specification\n\n${yaml}`;
}
