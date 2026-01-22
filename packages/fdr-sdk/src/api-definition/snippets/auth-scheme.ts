import type { ApiAuth } from "../../client/APIV1Read";
import type { AuthScheme, AuthSchemeId, CodeSnippet, EndpointDefinition } from "../latest";

/**
 * Get the first auth scheme ID for an endpoint, preferring multiAuth over legacy auth.
 * multiAuth provides proper OR-of-AND semantics for endpoint-specific security.
 */
export function getFirstAuthSchemeId(endpoint: EndpointDefinition): AuthSchemeId | undefined {
    if (endpoint.multiAuth != null && endpoint.multiAuth.length > 0) {
        const firstGroup = endpoint.multiAuth[0];
        if (firstGroup && firstGroup.schemes.length > 0) {
            return firstGroup.schemes[0];
        }
    }
    return endpoint.auth?.[0];
}

/**
 * Get the first auth scheme for an endpoint from the auths record.
 * Uses getFirstAuthSchemeId to select the correct auth scheme.
 */
export function getFirstAuthScheme<T extends AuthScheme | ApiAuth>(
    endpoint: EndpointDefinition,
    auths: Record<AuthSchemeId, T>
): T | undefined {
    const authId = getFirstAuthSchemeId(endpoint);
    return authId != null ? auths[authId] : undefined;
}

/**
 * Get the header name for an auth scheme.
 * Returns the header wire value for header auth, "Authorization" for bearer/OAuth, or undefined.
 */
export function getAuthHeaderName(auth: AuthScheme | ApiAuth | undefined): string | undefined {
    if (auth == null) {
        return undefined;
    }
    if (auth.type === "header") {
        return (auth as { headerWireValue?: string }).headerWireValue;
    }
    if (auth.type === "bearerAuth" || auth.type === "oAuth") {
        return "Authorization";
    }
    return undefined;
}

/**
 * Check if a snippet is likely auto-generated (not user-provided).
 * A snippet is considered likely generated if:
 * - generated === true, OR
 * - generated is undefined AND name, install, and description are all null
 */
export function isLikelyGeneratedSnippet(snippet: CodeSnippet): boolean {
    if (snippet.generated === true) {
        return true;
    }
    if (snippet.generated === false) {
        return false;
    }
    return snippet.name == null && snippet.install == null && snippet.description == null;
}

/**
 * Determine if a curl snippet should be regenerated because it has the wrong auth header.
 * Only regenerates if:
 * - No existing snippets exist, OR
 * - All existing snippets are likely generated AND none contain the expected header, OR
 * - For basic auth: existing snippets use -H "Authorization: Basic" instead of -u flag
 */
export function shouldRegenerateCurlSnippet(
    existingSnippets: CodeSnippet[] | undefined,
    expectedHeaderName: string | undefined,
    authScheme?: AuthScheme | ApiAuth
): boolean {
    if (existingSnippets == null || existingSnippets.length === 0) {
        return true;
    }

    const allLikelyGenerated = existingSnippets.every(isLikelyGeneratedSnippet);
    if (!allLikelyGenerated) {
        return false;
    }

    // For basic auth, check if snippets use -H "Authorization: Basic" instead of -u flag
    // If so, regenerate to use -u flag
    if (authScheme?.type === "basicAuth") {
        const usesBasicAuthHeader = existingSnippets.some(
            (s) => s.code.includes('-H "Authorization: Basic') || s.code.includes("-H 'Authorization: Basic")
        );
        if (usesBasicAuthHeader) {
            return true;
        }
        // If basic auth and no header found, check if -u flag is present
        const usesUFlag = existingSnippets.some((s) => s.code.includes("-u "));
        // If -u flag is present, no need to regenerate
        return !usesUFlag;
    }

    if (expectedHeaderName == null) {
        return false;
    }

    const hasCorrectHeader = existingSnippets.some(
        (s) => s.code.includes(`"${expectedHeaderName}:`) || s.code.includes(`'${expectedHeaderName}:`)
    );
    return !hasCorrectHeader;
}
