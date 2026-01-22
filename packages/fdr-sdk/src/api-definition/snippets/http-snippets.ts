import { HTTPSnippet } from "httpsnippet-lite";

import type { ApiDefinition, CodeSnippet, EndpointDefinition, ExampleEndpointCall } from "../latest";
import { getAuthHeaderName, getFirstAuthScheme, shouldRegenerateCurlSnippet } from "./auth-scheme";
import { HTTP_SNIPPET_CLIENTS } from "./constants";
import { convertToCurl } from "./curl";
import { getHarRequest } from "./get-har-request";
import { toSnippetHttpRequest } from "./SnippetHttpRequest";
import type { HttpSnippetLanguage, SnippetGenerationFlags, SnippetGenerators } from "./types";

/**
 * Options for HTTP snippet generation
 */
export interface HttpSnippetOptions {
    /** HTTP snippet generation flags */
    flags: SnippetGenerationFlags;
    /** Dynamic generators to check for available SDK snippets (optional) */
    dynamicGenerators?: SnippetGenerators;
    /** Existing snippets that should not be regenerated */
    existingSnippets?: Record<string, CodeSnippet[]>;
}

/**
 * Generate a curl snippet for an endpoint example
 */
export function generateCurlSnippet(
    apiDefinition: ApiDefinition,
    endpoint: EndpointDefinition,
    example: ExampleEndpointCall
): CodeSnippet {
    const authScheme = getFirstAuthScheme(endpoint, apiDefinition.auths);
    const curlCode = convertToCurl(toSnippetHttpRequest(endpoint, example, authScheme));

    return {
        name: undefined,
        language: "curl",
        install: undefined,
        code: curlCode,
        generated: true,
        description: undefined
    };
}

/**
 * Generate HTTP snippets for an endpoint example using httpsnippet-lite
 */
export async function generateHttpSnippets(
    apiDefinition: ApiDefinition,
    endpoint: EndpointDefinition,
    example: ExampleEndpointCall,
    options: HttpSnippetOptions
): Promise<CodeSnippet[]> {
    const { flags, dynamicGenerators = {}, existingSnippets = {} } = options;
    const snippets: CodeSnippet[] = [];

    const isHttpSnippetsEnabled = flags.httpSnippets !== false;
    const httpSnippetLanguages = Array.isArray(flags.httpSnippets) ? flags.httpSnippets : null;

    // Check if a language should be included based on the httpSnippets configuration
    const shouldIncludeLanguage = (language: string): boolean => {
        if (!isHttpSnippetsEnabled) {
            return language === "curl";
        }
        return httpSnippetLanguages == null || httpSnippetLanguages.includes(language as HttpSnippetLanguage);
    };

    // Generate or regenerate curl snippet if needed
    // Regenerate if existing snippet has wrong auth header (targeted repair for pre-stored snippets)
    // Also regenerate if basic auth uses -H "Authorization: Basic" instead of -u flag
    const authScheme = getFirstAuthScheme(endpoint, apiDefinition.auths);
    const expectedHeaderName = getAuthHeaderName(authScheme);
    const needsCurlRegeneration = shouldRegenerateCurlSnippet(existingSnippets.curl, expectedHeaderName, authScheme);

    if (needsCurlRegeneration && shouldIncludeLanguage("curl")) {
        snippets.push(generateCurlSnippet(apiDefinition, endpoint, example));
    }

    // Generate HTTP snippets for other languages
    if (isHttpSnippetsEnabled) {
        const harRequest = getHarRequest(endpoint, example, apiDefinition.auths, example.requestBody);
        const httpSnippet = new HTTPSnippet(harRequest);

        for (const { clientId, targetId } of HTTP_SNIPPET_CLIENTS) {
            // Skip if snippet already exists
            if (existingSnippets[targetId]?.length) {
                continue;
            }

            // Skip if dynamic SDK snippets are available for this language
            if (dynamicGenerators[targetId === "javascript" ? "typescript" : targetId]) {
                continue;
            }

            // Skip JavaScript if TypeScript snippets exist and alwaysEnableJavaScriptFetch is disabled
            if (
                targetId === "javascript" &&
                existingSnippets.typescript?.length &&
                !flags.alwaysEnableJavaScriptFetch
            ) {
                continue;
            }

            // Check if this language should be included
            if (!shouldIncludeLanguage(targetId)) {
                continue;
            }

            const convertedCode = await httpSnippet.convert(targetId, clientId);
            const code =
                typeof convertedCode === "string"
                    ? convertedCode
                    : convertedCode != null
                      ? convertedCode[0]
                      : undefined;

            if (code != null) {
                snippets.push({
                    name: undefined,
                    language: targetId,
                    install: undefined,
                    code,
                    generated: true,
                    description: undefined
                });
            }
        }
    }

    return snippets;
}

/**
 * Check if a language should be included for HTTP snippet generation based on flags
 */
export function shouldIncludeHttpSnippetLanguage(
    language: string,
    flags: Pick<SnippetGenerationFlags, "httpSnippets">
): boolean {
    const isHttpSnippetsEnabled = flags.httpSnippets !== false;
    const httpSnippetLanguages = Array.isArray(flags.httpSnippets) ? flags.httpSnippets : null;

    if (!isHttpSnippetsEnabled) {
        return language === "curl";
    }
    return httpSnippetLanguages == null || httpSnippetLanguages.includes(language as HttpSnippetLanguage);
}
