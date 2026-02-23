import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { HttpMethod } from "@fern-api/docs-utils";
import {
    CONTINUE,
    type Hast,
    isMdxJsxAttribute,
    isMdxJsxElementHast,
    mdxJsxAttributeToString,
    type Unified,
    visit
} from "@fern-docs/mdx";

const API_PROTOCOL = "api:";

/**
 * Preprocesses raw MDX content to URL-encode curly braces inside `api:` link hrefs.
 * Must run before MDX parsing, because MDX treats `{...}` as JSX expressions.
 *
 * Turns: [text](api:GET/v2/payments/{paymentId})
 * Into:  [text](api:GET/v2/payments/%7BpaymentId%7D)
 */
export function sanitizeApiLinks(content: string): string {
    return content.replace(/\]\(api:[^)]*\)/g, (match) => {
        return match.replaceAll("{", "%7B").replaceAll("}", "%7D");
    });
}

/**
 * Parses an `api:` href into method, path, and optional API name.
 * The `/` at the start of the path acts as the delimiter between method and path.
 *
 * Supported formats:
 *   api:POST/v2/payments                → { method, path }
 *   api:payments-api:POST/v2/payments   → { method, path, apiName }
 */
export function parseApiLinkHref(href: string): { method: HttpMethod; path: string; apiName?: string } | undefined {
    if (!href.startsWith(API_PROTOCOL)) {
        return undefined;
    }

    const value = href.slice(API_PROTOCOL.length);
    if (value.length === 0) {
        return undefined;
    }

    // Find the first `/` — everything before it contains the method (and optionally apiName), everything from it is the path
    const slashIndex = value.indexOf("/");
    if (slashIndex === -1) {
        return undefined;
    }

    const prefix = value.slice(0, slashIndex);
    // Decode URL-encoded curly braces back to `{` and `}` (encoded by sanitizeApiLinks)
    const path = value.slice(slashIndex).replaceAll("%7B", "{").replaceAll("%7D", "}");

    // Check if prefix contains a colon → "apiName:METHOD"
    const colonIndex = prefix.indexOf(":");
    if (colonIndex === -1) {
        // No colon → prefix is just the method: "POST/v2/payments"
        const method = prefix.toUpperCase() as HttpMethod;
        if (!HttpMethod[method]) {
            return undefined;
        }
        return { method, path };
    }

    // Has colon → "apiName:METHOD"
    const apiName = prefix.slice(0, colonIndex);
    const method = prefix.slice(colonIndex + 1).toUpperCase() as HttpMethod;

    if (!HttpMethod[method] || apiName.length === 0) {
        return undefined;
    }

    return { method, path, apiName };
}

/**
 * Resolves an `api:` link to its endpoint slug, falling back to the raw path on failure.
 */
async function resolveApiLink(
    loader: DocsLoader,
    parsed: { method: HttpMethod; path: string; apiName?: string }
): Promise<string> {
    try {
        const { slugs } = await loader.getEndpointByLocator(parsed.method, parsed.path, undefined, parsed.apiName);
        if (slugs.length > 0) {
            return `/${slugs[0]}`;
        }
        console.error(
            `Endpoint ${parsed.method} ${parsed.path} exists but is not in the navigation${parsed.apiName ? ` for API "${parsed.apiName}"` : ""}`
        );
    } catch {
        console.error(
            `Could not find endpoint ${parsed.method} ${parsed.path}${parsed.apiName ? ` in API "${parsed.apiName}"` : ""}. Check that the method, path, and API name match your API definition.`
        );
    }
    return parsed.path;
}

export const rehypeApiLinks: Unified.Plugin<[{ loader: DocsLoader }?], Hast.Root> = (opts) => {
    if (!opts) {
        return;
    }
    const loader = opts.loader;

    return async (ast: Hast.Root) => {
        const promises: Promise<void>[] = [];

        visit(ast, (node) => {
            // Case 1: plain HTML <a> elements (from standard markdown links)
            if (node.type === "element" && node.tagName === "a") {
                const href = node.properties.href;
                if (typeof href !== "string") {
                    return CONTINUE;
                }

                const parsed = parseApiLinkHref(href);
                if (parsed == null) {
                    return CONTINUE;
                }

                promises.push(
                    resolveApiLink(loader, parsed).then((resolved) => {
                        node.properties.href = resolved;
                    })
                );

                return CONTINUE;
            }

            // Case 2: MDX JSX elements that have an href attribute (e.g. <A href="api:...">)
            if (isMdxJsxElementHast(node)) {
                const hrefAttr = node.attributes.filter(isMdxJsxAttribute).find((attr) => attr.name === "href");
                if (hrefAttr == null) {
                    return CONTINUE;
                }

                const href = mdxJsxAttributeToString(hrefAttr);
                if (!href) {
                    return CONTINUE;
                }

                const parsed = parseApiLinkHref(href);
                if (parsed == null) {
                    return CONTINUE;
                }

                promises.push(
                    resolveApiLink(loader, parsed).then((resolved) => {
                        hrefAttr.value = resolved;
                    })
                );

                return CONTINUE;
            }

            return CONTINUE;
        });

        if (promises.length > 0) {
            await Promise.all(promises);
        }
    };
};
