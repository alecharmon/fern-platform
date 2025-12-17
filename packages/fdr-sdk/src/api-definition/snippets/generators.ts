/* eslint-disable @typescript-eslint/no-explicit-any */

import { SnippetResolver } from "@fern-api/snippets";

import type { EndpointDefinition } from "../latest";
import type { DynamicIRsByLanguage, SDK_SNIPPET_LANGUAGES, SdkSnippetLanguage, SnippetGenerators } from "./types";

/**
 * Build the endpoint path string used for snippet generation
 */
export function buildEndpointPath(endpoint: EndpointDefinition): string {
    return `${endpoint.method} ${endpoint.path
        .map((p) => {
            if (p.type === "pathParameter") {
                return `{${p.value}}`;
            }
            return p.value;
        })
        .join("")}`;
}

/**
 * Create snippet generators for all available languages in the dynamic IR
 */
export function createSnippetGenerators({
    endpoint,
    dynamicIr
}: {
    endpoint: EndpointDefinition;
    dynamicIr: DynamicIRsByLanguage;
}): SnippetGenerators {
    if (endpoint.method === "HEAD") {
        return {};
    }

    const snippetInputs = collectSnippetInputs(dynamicIr);

    if (snippetInputs.length === 0) {
        return {};
    }

    const snippetResolver = new SnippetResolver({ snippetInputs });
    const endpointPath = buildEndpointPath(endpoint);

    return buildGeneratorsFromResolver(snippetResolver, endpointPath, dynamicIr);
}

/**
 * Collect snippet inputs from dynamic IR for available languages
 */
function collectSnippetInputs(
    dynamicIr: DynamicIRsByLanguage
): Array<{ language: (typeof SDK_SNIPPET_LANGUAGES)[number]; ir: any }> {
    const inputs: Array<{ language: SdkSnippetLanguage; ir: any }> = [];

    if (dynamicIr.typescript) {
        inputs.push({ language: "typescript", ir: dynamicIr.typescript as any });
    }

    if (dynamicIr.python) {
        inputs.push({ language: "python", ir: dynamicIr.python as any });
    }

    if (dynamicIr.java) {
        inputs.push({ language: "java", ir: dynamicIr.java as any });
    }

    if (dynamicIr.ruby) {
        inputs.push({ language: "ruby", ir: dynamicIr.ruby as any });
    }

    if (dynamicIr.swift) {
        inputs.push({ language: "swift", ir: dynamicIr.swift as any });
    }

    if (dynamicIr.csharp) {
        inputs.push({ language: "csharp", ir: dynamicIr.csharp as any });
    }

    if (dynamicIr.go) {
        inputs.push({ language: "go", ir: dynamicIr.go as any });
    }

    if (dynamicIr.php) {
        inputs.push({ language: "php", ir: dynamicIr.php as any });
    }

    return inputs;
}

/**
 * Build generators from the snippet resolver for available languages
 */
function buildGeneratorsFromResolver(
    snippetResolver: SnippetResolver,
    endpointPath: string,
    dynamicIr: DynamicIRsByLanguage
): SnippetGenerators {
    const generators: SnippetGenerators = {};

    if (dynamicIr.typescript) {
        const sdk = snippetResolver.sdk("typescript");
        generators.typescript = sdk?.endpoint(endpointPath);
    }

    if (dynamicIr.python) {
        const sdk = snippetResolver.sdk("python");
        generators.python = sdk?.endpoint(endpointPath);
    }

    if (dynamicIr.java) {
        const sdk = snippetResolver.sdk("java");
        generators.java = sdk?.endpoint(endpointPath);
    }

    if (dynamicIr.ruby) {
        const sdk = snippetResolver.sdk("ruby");
        generators.ruby = sdk?.endpoint(endpointPath);
    }

    if (dynamicIr.swift) {
        const sdk = snippetResolver.sdk("swift");
        generators.swift = sdk?.endpoint(endpointPath);
    }

    if (dynamicIr.csharp) {
        const sdk = snippetResolver.sdk("csharp");
        generators.csharp = sdk?.endpoint(endpointPath);
    }

    if (dynamicIr.go) {
        const sdk = snippetResolver.sdk("go");
        generators.go = sdk?.endpoint(endpointPath);
    }

    if (dynamicIr.php) {
        const sdk = snippetResolver.sdk("php");
        generators.php = sdk?.endpoint(endpointPath);
    }

    return generators;
}
