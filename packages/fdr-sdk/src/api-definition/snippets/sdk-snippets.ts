/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ApiDefinition, AuthScheme, CodeSnippet, EndpointDefinition, ExampleEndpointCall } from "../latest";
import { getFirstAuthScheme } from "./auth-scheme";
import type { SnippetGenerators } from "./types";

/**
 * Build the auth object for SDK snippet generators based on the auth scheme.
 * Returns a properly formatted auth object compatible with @fern-api/snippets generators.
 */
function buildSnippetAuth(authScheme: AuthScheme | undefined): any {
    if (!authScheme) {
        return undefined;
    }

    switch (authScheme.type) {
        case "bearerAuth":
            return {
                type: "bearer",
                token: "YOUR_TOKEN_HERE"
            };
        case "basicAuth":
            return {
                type: "basic",
                username: "YOUR_USERNAME_HERE",
                password: "YOUR_PASSWORD_HERE"
            };
        case "header":
            return {
                type: "header",
                value: "YOUR_API_KEY_HERE"
            };
        case "oAuth":
            // OAuth uses bearer token format for SDK snippets
            return {
                type: "bearer",
                token: "YOUR_TOKEN_HERE"
            };
        default:
            return undefined;
    }
}

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
    const authDefinition = getFirstAuthScheme(endpoint, apiDefinition.auths);
    const auth = buildSnippetAuth(authDefinition);

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
