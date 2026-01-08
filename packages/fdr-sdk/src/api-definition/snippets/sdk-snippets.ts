/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ApiDefinition, CodeSnippet, EndpointDefinition, ExampleEndpointCall } from "../latest";
import { getFirstAuthScheme } from "./auth-scheme";
import type { SnippetGenerators } from "./types";

/**
 * Build the SDK snippet request from an endpoint example.
 * Returns a request object compatible with @fern-api/snippets generators.
 */
export function buildSdkSnippetRequest(
    apiDefinition: ApiDefinition,
    endpoint: EndpointDefinition,
    example: ExampleEndpointCall
): any {
    // Build auth configuration using multiAuth-aware selection
    let auth: any;
    const authDefinition = getFirstAuthScheme(endpoint, apiDefinition.auths);
    if (authDefinition) {
        if (authDefinition.type === "bearerAuth") {
            auth = {
                type: "bearer",
                token: "YOUR_TOKEN_HERE"
            };
        } else {
            auth = authDefinition;
        }
    }

    // Process request body (filter out empty objects)
    let bodyValue: unknown = undefined;
    if (example.requestBody != null && example.requestBody.type === "json" && example.requestBody.value) {
        if (typeof example.requestBody.value === "object" && !Array.isArray(example.requestBody.value)) {
            const filteredValue = Object.fromEntries(
                Object.entries(example.requestBody.value).filter(([_, valueObj]) => {
                    // Keep arrays and primitive values
                    if (Array.isArray(valueObj) || typeof valueObj !== "object" || valueObj == null) {
                        return true;
                    }
                    // For objects, only filter out empty objects without a value property
                    return Object.keys(valueObj).length > 0;
                })
            );
            bodyValue = filteredValue;
        } else {
            bodyValue = example.requestBody.value;
        }
    }

    return {
        baseURL:
            endpoint?.environments?.find((env) => env.id === endpoint.defaultEnvironment)?.baseUrl ??
            endpoint?.environments?.[0]?.baseUrl,
        auth,
        pathParameters: example.pathParameters,
        queryParameters: example.queryParameters,
        headers: example.headers,
        requestBody: bodyValue,
        method: endpoint.method
    };
}

/**
 * Generate SDK snippets for an endpoint example using the provided generators
 */
export function generateSdkSnippets(
    apiDefinition: ApiDefinition,
    endpoint: EndpointDefinition,
    example: ExampleEndpointCall,
    generators: SnippetGenerators
): CodeSnippet[] {
    if (endpoint.method === "HEAD") {
        return [];
    }

    const snippets: CodeSnippet[] = [];
    const request = buildSdkSnippetRequest(apiDefinition, endpoint, example);

    for (const [language, generator] of Object.entries(generators)) {
        if (!generator) {
            continue;
        }

        try {
            const result = generator.generateSync(request);

            if (result?.snippet) {
                snippets.push({
                    name: undefined,
                    language,
                    install: undefined,
                    code: result.snippet,
                    generated: true,
                    description: undefined
                });
            }
        } catch (error) {
            console.error(`Error generating ${language} snippet:`, error);
        }
    }

    return snippets;
}

/**
 * Generate a single SDK snippet for a specific language
 */
export function generateSdkSnippetForLanguage(
    apiDefinition: ApiDefinition,
    endpoint: EndpointDefinition,
    example: ExampleEndpointCall,
    generators: SnippetGenerators,
    language: string
): CodeSnippet | undefined {
    if (endpoint.method === "HEAD") {
        return undefined;
    }

    const generator = generators[language];
    if (!generator) {
        return undefined;
    }

    const request = buildSdkSnippetRequest(apiDefinition, endpoint, example);

    try {
        const result = generator.generateSync(request);

        if (result?.snippet) {
            return {
                name: undefined,
                language,
                install: undefined,
                code: result.snippet,
                generated: true,
                description: undefined
            };
        }
    } catch (error) {
        console.error(`Error generating ${language} snippet:`, error);
    }

    return undefined;
}
