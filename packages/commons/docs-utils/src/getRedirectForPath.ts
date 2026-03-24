import type { DocsV1Read, DocsV2Read } from "@fern-api/fdr-sdk/client/types";
import { compile, match } from "path-to-regexp";
import urljoin from "url-join";

import { removeTrailingSlash } from "./trailing-slash";

/**
 * Match a path against a pattern, wrapped in a try-catch block to prevent crashes
 *
 * @param pattern path should follow path-to-regexp@6 syntax
 * @param path the current path to match against
 * @returns false if the path does not match the pattern, otherwise an object with the params and the path
 */
export function matchPath(pattern: string, path: string): ReturnType<ReturnType<typeof match>> {
    if (pattern === path) {
        return { params: {}, path, index: 0 };
    }

    // Skip absolute URLs — they cannot be matched against a local path
    if (/^https?:\/\//.test(pattern)) {
        return false;
    }

    // Strip query strings from the pattern — path-to-regexp only handles pathnames,
    // and `?` is interpreted as an optional modifier, causing parse errors.
    const patternWithoutQuery = pattern.split("?")[0]!;

    try {
        return match(patternWithoutQuery)(path);
    } catch (e) {
        console.error(`[redirect-for-path:match-path] ${JSON.stringify(e)}, { ${pattern}, ${path} }`);
        return false;
    }
}

function safeCompile(
    destination: string,
    match: Exclude<ReturnType<typeof matchPath>, false>
): ReturnType<ReturnType<typeof compile>> {
    try {
        // Skip compilation if there are no captured parameters to substitute
        if (Object.keys(match.params as Record<string, string>).length === 0) {
            return destination;
        }

        // For absolute URLs, compile only the path portion to avoid
        // path-to-regexp interpreting the protocol's colon as a parameter
        if (/^https?:\/\//.test(destination)) {
            const url = new URL(destination);
            url.pathname = compile(url.pathname)(match.params);
            return url.toString();
        }

        return compile(destination)(match.params);
    } catch (e) {
        console.error(`[redirect-for-path:safe-compile] ${e}, { ${JSON.stringify(match)}, ${destination} }`);
        return destination;
    }
}

export function getRedirectForPath(
    pathWithoutBasepath: string,
    baseUrl: DocsV2Read.BaseUrl,
    redirects: DocsV1Read.RedirectConfig[] = []
): { destination: string; permanent: boolean } | undefined {
    for (const redirect of redirects) {
        const source = removeTrailingSlash(withBasepath(redirect.source, baseUrl.basePath));
        const result = matchPath(source, pathWithoutBasepath);
        if (result) {
            const destination = safeCompile(redirect.destination, result);

            console.debug({ match: redirect, result });

            if (!destination.startsWith("/")) {
                try {
                    new URL(destination);
                } catch (e) {
                    console.error("Invalid redirect destination:", destination, e);
                    return undefined;
                }
            }

            // Skip redirect if destination equals source to prevent infinite redirect loops
            const normalizedSource = removeTrailingSlash(pathWithoutBasepath);
            const normalizedDestination = removeTrailingSlash(destination);
            if (normalizedSource === normalizedDestination) {
                console.debug(`[redirect-for-path] Skipping redirect where destination equals source: ${destination}`);
                continue;
            }

            // - Do NOT conform trailing slash in the destination because this relies on the user's direct configuration
            // - Do encode the URI to prevent any potential issues with special characters
            return {
                destination: encodeURI(destination),
                permanent: redirect.permanent ?? true
            };
        }
    }
    return undefined;
}

function withBasepath(source: string, basePath: string | undefined): string {
    return basePath == null ? source : source.startsWith(basePath) ? source : urljoin(basePath, source);
}
