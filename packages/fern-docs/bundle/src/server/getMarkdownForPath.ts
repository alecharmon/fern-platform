import { createPruneKey } from "@fern-api/docs-loader";
import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import { EndpointDefinition } from "@fern-api/fdr-sdk/api-definition";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { isNonNullish } from "@fern-api/ui-core-utils";

import { OpenApiYamlFormatter } from "./endpointDefinitionToOpenApi";
import { convertToLlmTxtMarkdown } from "./llm-txt-md";

function generateEndpointSections(
  endpoint: EndpointDefinition,
  apiDefinition?: ApiDefinition.ApiDefinition
): string[] {
  const sections: string[] = [];

  // Use the new OpenApiYamlFormatter class
  const formatter = new OpenApiYamlFormatter();
  const openApiYaml = formatter.generateYamlFromEndpoint(
    endpoint,
    apiDefinition
  );

  sections.push(
    `## OpenAPI Specification\n\n\`\`\`yaml\n${openApiYaml}\n\`\`\``
  );

  return sections;
}

export async function getMarkdownForPath(
  node: FernNavigation.NavigationNodePage,
  loader: DocsLoader,
  domain?: string
): Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined> {
  if (FernNavigation.isApiLeaf(node)) {
    const apiDefinition = await loader.getPrunedApi(
      node.apiDefinitionId,
      createPruneKey(node)
    );
    if (apiDefinition == null) {
      return undefined;
    }
    if (node.type === "endpoint") {
      const endpoint = apiDefinition.endpoints[node.endpointId];
      if (endpoint == null) {
        return undefined;
      }
      return {
        content: endpointDefinitionToMarkdown(
          endpoint,
          node,
          domain,
          apiDefinition
        ),
        contentType: "mdx",
      };
    }
  }

  const pageId = FernNavigation.getPageId(node);
  if (pageId == null) {
    return undefined;
  }

  const page = await loader.getPage(pageId);
  if (!page) {
    return undefined;
  }

  return {
    content: convertToLlmTxtMarkdown(
      page.markdown,
      node.title,
      pageId.endsWith(".mdx") ? "mdx" : "md"
    ),
    contentType: pageId.endsWith(".mdx") ? "mdx" : "markdown",
  };
}

export function getPageNodeForPath(
  root: FernNavigation.RootNode | undefined,
  path: string
): FernNavigation.NavigationNodePage | undefined {
  if (root == null) {
    return undefined;
  }
  const found = FernNavigation.utils.findNode(root, slugjoin(path));
  if (found.type !== "found" || !FernNavigation.isPage(found.node)) {
    return undefined;
  }
  return found.node;
}

export function endpointDefinitionToMarkdown(
  endpoint: EndpointDefinition,
  node: FernNavigation.NavigationNodePage,
  domain?: string,
  apiDefinition?: ApiDefinition.ApiDefinition
): string {
  const pageHref = slugToHref(node.canonicalSlug ?? node.slug);
  const fullUrl = domain ? `https://${domain}${pageHref}` : undefined;

  const endpointSections = generateEndpointSections(endpoint, apiDefinition);

  const examplesContent = endpoint.examples
    ?.flatMap((example) => {
      // We have examples for all status codes (although the code will be repeated)
      // So only process examples with response status code 201
      // Only skip if the status code is not a 2xx "OK" HTTP status code
      if (
        typeof example.responseStatusCode !== "number" ||
        example.responseStatusCode < 200 ||
        example.responseStatusCode >= 300
      ) {
        return [];
      }

      return Object.entries(example.snippets ?? {}).flatMap(
        ([language, snippets]) => {
          // Filter out curl snippets, since AI should know how to use curl. SDK examples are specific to that generated SDK, so that would be helpful to use.
          if (language === "curl") {
            return [];
          }

          return snippets.map((snippet) => {
            return {
              language,
              snippet,
              name: snippet.name ?? example.name,
            } as const;
          });
        }
      );
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
      endpoint.requests?.[0] != null
        ? `Content-Type: ${endpoint.requests[0].contentType}`
        : undefined,
    ]
      .filter(isNonNullish)
      .join("\n"),
    typeof endpoint.description === "string" ? endpoint.description : undefined,
    fullUrl ? `Reference: ${fullUrl}` : undefined,
    ...endpointSections,
    hasExamples ? "## SDK Code Examples" : undefined,
    hasExamples ? examplesContent : undefined,
  ]
    .filter(isNonNullish)
    .join("\n\n");
}
