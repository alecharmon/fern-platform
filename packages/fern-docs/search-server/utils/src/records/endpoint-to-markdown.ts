import { slugToHref } from "@fern-api/docs-utils";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import { ApiDefinition } from "@fern-api/fdr-sdk";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { dump as yamlStringify } from "js-yaml";

import { generateOpenApiSpec } from "./generateOpenApiSpec";

function generateEndpointSections(
    endpoint: ApiDefinition.EndpointDefinition,
    apiDefinition?: ApiDefinition.ApiDefinition
): string[] {
    const sections: string[] = [];

    try {
        const endpointId = endpoint.id as ApiDefinition.EndpointId;
        const minimalApiDef: ApiDefinition.ApiDefinition = {
            id: apiDefinition?.id ?? ("" as ApiDefinition.ApiDefinitionId),
            apiName: apiDefinition?.apiName,
            endpoints: { [endpointId]: endpoint },
            websockets: {},
            webhooks: {},
            types: apiDefinition?.types ?? {},
            subpackages: apiDefinition?.subpackages ?? {},
            auths: apiDefinition?.auths ?? {},
            globalHeaders: apiDefinition?.globalHeaders,
            graphqlOperations: {},
            snippetsConfiguration: apiDefinition?.snippetsConfiguration
        };

        const openApiSpec = generateOpenApiSpec(minimalApiDef);
        const openApiYaml = yamlStringify(openApiSpec);

        sections.push(`## OpenAPI Specification\n\n\`\`\`yaml\n${openApiYaml}\n\`\`\``);
    } catch (error) {
        console.error(JSON.stringify(error));
    }

    return sections;
}

/**
 * Converts an endpoint definition to markdown format for indexing.
 * This uses the same logic as llms.txt endpoint markdown generation,
 * including OpenAPI spec generation from PR #3788.
 */
export function endpointToMarkdown(
    endpoint: ApiDefinition.EndpointDefinition,
    node: FernNavigation.EndpointNode,
    domain: string,
    apiDefinition?: ApiDefinition.ApiDefinition
): string {
    const pageHref = slugToHref(node.canonicalSlug ?? node.slug);
    const fullUrl = `https://${domain}${pageHref}`;

    const endpointSections = generateEndpointSections(endpoint, apiDefinition);

    const examplesContent = endpoint.examples
        ?.flatMap((example) => {
            if (
                typeof example.responseStatusCode !== "number" ||
                example.responseStatusCode < 200 ||
                example.responseStatusCode >= 300
            ) {
                return [];
            }

            return Object.entries(example.snippets ?? {}).flatMap(([language, snippets]) => {
                if (language === "curl") {
                    return [];
                }

                return snippets.map((snippet) => {
                    return {
                        language,
                        snippet,
                        name: snippet.name ?? example.name
                    } as const;
                });
            });
        })
        .map(
            ({ language, snippet, name }) =>
                `\`\`\`${language}${name != null ? ` ${name}` : ""}\n${snippet.code}\n\`\`\``
        )
        .join("\n\n");

    const hasExamples = examplesContent && examplesContent.trim().length > 0;

    return [
        `# ${node.title}`,
        [
            `${endpoint.method} ${endpoint.environments?.find((env) => env.id === endpoint.defaultEnvironment)?.baseUrl ?? endpoint.environments?.[0]?.baseUrl ?? ""}${ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path)}`,
            endpoint.requests?.[0] != null ? `Content-Type: ${endpoint.requests[0].contentType}` : undefined
        ]
            .filter(isNonNullish)
            .join("\n"),
        typeof endpoint.description === "string" ? endpoint.description : undefined,
        fullUrl ? `Reference: ${fullUrl}` : undefined,
        ...endpointSections,
        hasExamples ? "## SDK Code Examples" : undefined,
        hasExamples ? examplesContent : undefined
    ]
        .filter(isNonNullish)
        .join("\n\n");
}
