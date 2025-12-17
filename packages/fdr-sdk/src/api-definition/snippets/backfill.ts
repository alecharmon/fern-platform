/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ApiDefinition, CodeSnippet, EndpointDefinition, ExampleEndpointCall } from "../latest";
import { createSnippetGenerators } from "./generators";
import { generateHttpSnippets, shouldIncludeHttpSnippetLanguage } from "./http-snippets";
import { generateSdkSnippets } from "./sdk-snippets";
import type { DynamicIRsByLanguage, SnippetGenerationFlags, SnippetGenerators } from "./types";

/**
 * Backfill snippets for an entire API definition.
 * This is the main entry point for snippet generation during docs loading.
 */
export async function backfillSnippets(
    apiDefinition: ApiDefinition,
    dynamicIr: DynamicIRsByLanguage | undefined,
    flags: SnippetGenerationFlags
): Promise<ApiDefinition> {
    return {
        ...apiDefinition,
        endpoints: await Promise.all(
            Object.entries(apiDefinition.endpoints).map(async ([id, endpoint]) => {
                let dynamicGenerators: SnippetGenerators = {};
                try {
                    if (dynamicIr) {
                        dynamicGenerators = createSnippetGenerators({ endpoint, dynamicIr });
                    }
                } catch (error) {
                    console.log("[backfill] error creating dynamic snippet generators:", error);
                }

                return [
                    id,
                    {
                        ...endpoint,
                        examples: await Promise.all(
                            endpoint.examples?.map((example) =>
                                backfillSnippetsForExample(apiDefinition, dynamicGenerators, endpoint, example, flags)
                            ) ?? []
                        )
                    }
                ] as const;
            })
        ).then((entries) => Object.fromEntries(entries))
    };
}

/**
 * Backfill snippets for a single endpoint example.
 * Combines SDK snippets (from dynamic IR) and HTTP snippets (from httpsnippet-lite).
 */
export async function backfillSnippetsForExample(
    apiDefinition: ApiDefinition,
    dynamicGenerators: SnippetGenerators,
    endpoint: EndpointDefinition,
    example: ExampleEndpointCall,
    flags: SnippetGenerationFlags
): Promise<ExampleEndpointCall> {
    const snippets = { ...example.snippets };

    const pushSnippet = (snippet: CodeSnippet) => {
        (snippets[snippet.language] ??= []).push(snippet);
    };

    // Remove curl if it shouldn't be included
    if (snippets.curl?.length && !shouldIncludeHttpSnippetLanguage("curl", flags)) {
        delete snippets.curl;
    }

    // Generate SDK snippets from dynamic IR
    if (Object.keys(dynamicGenerators).length > 0 && endpoint.method !== "HEAD") {
        const sdkSnippets = generateSdkSnippets(apiDefinition, endpoint, example, dynamicGenerators);
        for (const snippet of sdkSnippets) {
            pushSnippet(snippet);
        }
    }

    // Generate HTTP snippets (curl and httpsnippet-lite)
    const httpSnippets = await generateHttpSnippets(apiDefinition, endpoint, example, {
        flags,
        dynamicGenerators,
        existingSnippets: snippets
    });
    for (const snippet of httpSnippets) {
        pushSnippet(snippet);
    }

    return { ...example, snippets };
}

/**
 * Generate all snippets for a single example without modifying the original.
 * This is a utility function for use in FDR registration and other contexts.
 */
export async function generateSnippetsForExample(
    apiDefinition: ApiDefinition,
    endpoint: EndpointDefinition,
    example: ExampleEndpointCall,
    dynamicIr: DynamicIRsByLanguage | undefined,
    flags: SnippetGenerationFlags
): Promise<Record<string, CodeSnippet[]>> {
    let dynamicGenerators: SnippetGenerators = {};

    try {
        if (dynamicIr) {
            dynamicGenerators = createSnippetGenerators({ endpoint, dynamicIr });
        }
    } catch (error) {
        console.log("[generateSnippetsForExample] error creating dynamic snippet generators:", error);
    }

    const snippets: Record<string, CodeSnippet[]> = { ...example.snippets };

    const pushSnippet = (snippet: CodeSnippet) => {
        (snippets[snippet.language] ??= []).push(snippet);
    };

    // Generate SDK snippets
    if (Object.keys(dynamicGenerators).length > 0 && endpoint.method !== "HEAD") {
        const sdkSnippets = generateSdkSnippets(apiDefinition, endpoint, example, dynamicGenerators);
        for (const snippet of sdkSnippets) {
            pushSnippet(snippet);
        }
    }

    // Generate HTTP snippets
    const httpSnippets = await generateHttpSnippets(apiDefinition, endpoint, example, {
        flags,
        dynamicGenerators,
        existingSnippets: snippets
    });
    for (const snippet of httpSnippets) {
        pushSnippet(snippet);
    }

    return snippets;
}
