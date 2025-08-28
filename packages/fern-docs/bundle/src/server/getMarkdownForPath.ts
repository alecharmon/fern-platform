import { DocsLoader, createPruneKey } from "@fern-api/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import { EndpointDefinition } from "@fern-api/fdr-sdk/api-definition";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { isNonNullish } from "@fern-api/ui-core-utils";

import { convertToLlmTxtMarkdown } from "./llm-txt-md";

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
        content: endpointDefinitionToMarkdown(endpoint, node, domain),
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

// function getPageInfo(
//     root: FernNavigation.RootNode | undefined,
//     slug: FernNavigation.Slug,
// ):
//     | {
//           nodeTitle: string;
//           pageId?: FernNavigation.PageId;
//           apiLeaf?: FernNavigation.NavigationNodeApiLeaf;
//       }
//     | undefined {
//     if (root == null) {
//         return undefined;
//     }

//     const foundNode = FernNavigation.utils.findNode(root, slug);
//     if (foundNode == null || foundNode.type !== "found" || !FernNavigation.isPage(foundNode.node)) {
//         return undefined;
//     }

//     if (FernNavigation.isApiLeaf(foundNode.node)) {
//         return {
//             nodeTitle: foundNode.node.title,
//             apiLeaf: foundNode.node,
//         };
//     }

//     const pageId = FernNavigation.getPageId(foundNode.node);
//     if (pageId == null) {
//         return undefined;
//     }

//     return {
//         nodeTitle: foundNode.node.title,
//         pageId,
//     };
// }

export function endpointDefinitionToMarkdown(
  endpoint: EndpointDefinition,
  node: FernNavigation.NavigationNodePage,
  domain?: string
): string {
  const pageHref = slugToHref(node.canonicalSlug ?? node.slug);
  const fullUrl = domain ? `https://${domain}${pageHref}` : undefined;

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
    endpoint.examples?.some(
      (example) => example.snippets && Object.keys(example.snippets).length > 0
    )
      ? "## Examples"
      : undefined,
    endpoint.examples
      ?.flatMap((example) =>
        Object.entries(example.snippets ?? {}).flatMap(([language, snippets]) =>
          snippets.map(
            (snippet) =>
              ({
                language,
                snippet,
                name: snippet.name ?? example.name,
              }) as const
          )
        )
      )
      .map(
        ({ language, snippet, name }) =>
          `\`\`\`${language === "curl" ? "shell" : language}${name != null ? ` ${name}` : ""}\n${snippet.code}\n\`\`\``
      )
      .join("\n\n"),
  ]
    .filter(isNonNullish)
    .join("\n\n");
}
