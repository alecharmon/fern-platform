import { isNonNullish } from "@fern-api/ui-core-utils";
import { getFrontmatter, isMdxJsxElementHast, mdastToMarkdown, toTree, visit } from "@fern-docs/mdx";

export function convertToLlmTxtMarkdown(
    markdown: string,
    nodeTitle: string,
    format: "mdx" | "md",
    userRoles: string[] = []
): string {
    const { title, description, content } = getLlmTxtMetadata(markdown, nodeTitle);
    // TODO: add link-backs to the source of the content
    // TODO: parse the markdown content and delete any unnecessary content

    return [
        `# ${title}`,
        description != null ? `> ${description}` : undefined,
        stripMdxFeatures(content, format, userRoles)
    ]
        .filter(isNonNullish)
        .join("\n\n");
}

/**
 * This is a living list of mdx features that we don't want to include in the LLM TXT format:
 * - esm imports
 * - <style> and <script> tags
 * - img tags with data: urls
 * - <If> tags when user doesn't have required roles
 * - <llms-ignore> tags (never shown to LLMs)
 * - <llms-only> tags are unwrapped (content always shown to LLMs)
 */
function stripMdxFeatures(markdown: string, format: "mdx" | "md", userRoles: string[] = []): string {
    if (format !== "mdx") {
        return markdown;
    }

    const { mdast } = toTree(markdown, {
        format,
        sanitize: true
    });

    visit(mdast, (node, idx, parent) => {
        if (parent == null || idx == null) {
            return;
        }

        if (isMdxJsxElementHast(node)) {
            // remove <llms-ignore> tags and their content (never show to LLMs)
            if (node.name === "llms-ignore") {
                parent.children.splice(idx, 1);
                return idx;
            }

            // replace <llms-only> with its children (always show to LLMs)
            if (node.name === "llms-only") {
                parent.children.splice(idx, 1, ...node.children);
                return idx;
            }

            // remove <If> tags when user doesn't have required roles
            // Note: supports both "roles" and "viewer" attributes for backwards compatibility
            if (node.name === "If") {
                const rolesAttr =
                    node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "roles") ??
                    node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "viewer");

                let requiredRoles: string[] = [];

                if (rolesAttr && rolesAttr.value != null) {
                    // Handle array format: roles={["admin", "editor"]} or viewer={["everyone"]}
                    if (typeof rolesAttr.value === "object" && "value" in rolesAttr.value) {
                        const expressionValue = (rolesAttr.value as { value: unknown }).value;
                        if (typeof expressionValue === "string") {
                            try {
                                const parsed = JSON.parse(expressionValue);
                                if (Array.isArray(parsed)) {
                                    requiredRoles = parsed.filter((r: unknown) => typeof r === "string");
                                }
                            } catch {
                                // If parsing fails, log and continue with empty roles (will show content)
                                console.error(`Failed to parse roles attribute: ${expressionValue}`);
                            }
                        }
                    }
                }

                const hasEveryoneRole = requiredRoles.includes("everyone");
                const hasRequiredRole = userRoles.some((role) => requiredRoles.includes(role));
                // If no roles specified or parsing failed, default to showing content
                const noRolesSpecified = requiredRoles.length === 0;

                const shouldShowContent = hasEveryoneRole || hasRequiredRole || noRolesSpecified;

                if (!shouldShowContent) {
                    parent.children.splice(idx, 1);
                    return idx;
                } else {
                    parent.children.splice(idx, 1, ...node.children);
                    return idx;
                }
            }

            // remove <style> and <script> tags
            if (node.name === "style" || node.name === "script") {
                parent.children.splice(idx, 1);
                return idx;
            }

            // remove imgs and related tags that reference data: urls
            const src = node.attributes.find((attr) => attr.type === "mdxJsxAttribute" && attr.name === "src")?.value;
            if (typeof src === "string" && src.startsWith("data:")) {
                parent.children.splice(idx, 1);
                return idx;
            }

            node.attributes = node.attributes.filter((attr) =>
                attr.type === "mdxJsxAttribute" ? attr.name !== "className" && attr.name !== "style" : true
            );

            if (node.name === "div" || node.name === "span" || node.name === "p" || node.name === "section") {
                if (node.children.length === 0) {
                    parent.children.splice(idx, 1);
                    return idx;
                }
            }
        }

        if (node.type === "mdxjsEsm") {
            if (node.data?.estree != null) {
                if (node.data.estree.body[0]?.type !== "ExportNamedDeclaration") {
                    parent.children.splice(idx, 1);
                    return idx;
                }
            }
        }

        return;
    });

    return mdastToMarkdown(mdast);
}

interface LlmTxtMetadata {
    title: string;
    description: string | undefined;
    content: string;
}

export function getLlmTxtMetadata(markdown: string, nodeTitle: string): LlmTxtMetadata {
    const { data: frontmatter, content } = getFrontmatter(markdown);
    return {
        // TODO: parse the first h1 as the title
        title: frontmatter.title ?? nodeTitle,
        /**
         * Note: the description field in the frontmatter is expected to be the most descriptive
         * which is useful for LLM context. However, it's not always available, so we fall back
         * to other fields. But, effectively only one is selected to avoid redundancy.
         */
        description:
            frontmatter.description ??
            frontmatter["og:description"] ??
            frontmatter.subtitle ??
            frontmatter.headline ??
            frontmatter.excerpt,
        content
    };
}
