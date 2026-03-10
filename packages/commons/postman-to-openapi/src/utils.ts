import type { PostmanDescription, PostmanDescriptionObject, PostmanUrl, PostmanVariable } from "./postman-types.js";

/**
 * Extracts a plain string from a Postman description.
 */
export function extractDescription(desc: PostmanDescription | undefined): string | undefined {
    if (desc == null) {
        return undefined;
    }
    if (typeof desc === "string") {
        return desc || undefined;
    }
    return (desc as PostmanDescriptionObject).content || undefined;
}

/**
 * Resolves Postman variables in a string (e.g. {{baseUrl}} → {baseUrl}).
 * Converts Postman-style `{{var}}` to OpenAPI-style `{var}`.
 */
export function resolveVariables(input: string, variables?: PostmanVariable[]): string {
    let result = input;
    if (variables) {
        for (const v of variables) {
            if (v.key != null && v.value != null) {
                result = result.replace(new RegExp(`\\{\\{${escapeRegExp(v.key)}\\}\\}`, "g"), String(v.value));
            }
        }
    }
    // Convert remaining {{var}} to {var} for OpenAPI path parameters
    return result.replace(/\{\{([^}]+)\}\}/g, "{$1}");
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts the raw URL string from a PostmanUrl.
 */
export function extractRawUrl(url: PostmanUrl | string | undefined): string {
    if (url == null) {
        return "";
    }
    if (typeof url === "string") {
        return url;
    }
    if (url.raw) {
        return url.raw;
    }
    // Reconstruct from parts
    const protocol = url.protocol ?? "https";
    const host = Array.isArray(url.host) ? url.host.join(".") : (url.host ?? "");
    const port = url.port ? `:${url.port}` : "";
    const path = url.path
        ? `/${url.path
              .map((p) => {
                  if (typeof p === "string") {
                      return p;
                  }
                  return p.value ?? "";
              })
              .join("/")}`
        : "";
    return `${protocol}://${host}${port}${path}`;
}

/**
 * Parses a URL string into base URL and path components.
 * Handles Postman-style path variables (`:var` and `{{var}}`).
 */
export function parseUrl(
    rawUrl: string,
    variables?: PostmanVariable[]
): { baseUrl: string; path: string; pathSegments: string[] } {
    const resolved = resolveVariables(rawUrl, variables);

    try {
        // Handle path-only URLs
        if (resolved.startsWith("/")) {
            const pathSegments = resolved.split("/").filter(Boolean);
            return { baseUrl: "", path: normalizePathForOpenApi(resolved), pathSegments };
        }

        const url = new URL(resolved.startsWith("http") ? resolved : `https://${resolved}`);
        const baseUrl = `${url.protocol}//${url.host}`;
        const path = url.pathname === "/" ? "/" : url.pathname;
        const pathSegments = path.split("/").filter(Boolean);
        return { baseUrl, path: normalizePathForOpenApi(path), pathSegments };
    } catch {
        // Fallback: try to split on first /
        const protocolMatch = resolved.match(/^(https?:\/\/[^/]+)(\/.*)?$/);
        if (protocolMatch) {
            const baseUrl = protocolMatch[1] ?? "";
            const path = protocolMatch[2] ?? "/";
            return { baseUrl, path: normalizePathForOpenApi(path), pathSegments: path.split("/").filter(Boolean) };
        }
        return { baseUrl: "", path: "/", pathSegments: [] };
    }
}

/**
 * Converts `:paramName` style path parameters to `{paramName}` for OpenAPI.
 */
function normalizePathForOpenApi(path: string): string {
    return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}

/**
 * Generates a unique operation ID from the method and path.
 */
export function generateOperationId(method: string, path: string): string {
    const parts = path
        .split("/")
        .filter(Boolean)
        .map((segment) => {
            // Remove path parameter braces
            const cleaned = segment.replace(/[{}:]/g, "");
            return cleaned;
        });

    const camelCase = parts
        .map((part, index) => {
            if (index === 0) {
                return part.toLowerCase();
            }
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join("");

    return `${method.toLowerCase()}${camelCase ? camelCase.charAt(0).toUpperCase() + camelCase.slice(1) : ""}`;
}

/**
 * Sanitizes a string for use as a tag name.
 */
export function sanitizeTagName(name: string): string {
    return name.trim();
}
