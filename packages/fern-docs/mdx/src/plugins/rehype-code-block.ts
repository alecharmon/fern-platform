// inspired by https://github.com/remcohaszing/hast-util-properties-to-mdx-jsx-attributes

import { compact, flatten } from "es-toolkit/array";
import { escape } from "es-toolkit/string";
import type { Root as HastRoot } from "hast";
import { propertiesToMdxJsxAttributes } from "hast-util-properties-to-mdx-jsx-attributes";
import type { RootContent as MdastRootContent } from "mdast";
import parseNumericRange from "parse-numeric-range";
import { SKIP, visit } from "unist-util-visit";
import { mdastFromMarkdown } from "../mdast-utils/mdast-from-markdown";
import { isMdxJsxElementHast } from "../mdx-utils";
import type { Unified } from "../unified";

export const rehypeCodeBlock: Unified.Plugin<[], HastRoot> = () => {
    return async (tree) => {
        visit(tree, (node) => {
            if (!isMdxJsxElementHast(node)) {
                return;
            }

            if (node.name === "CodeBlocks") {
                node.name = "CodeGroup";
            }

            if (node.name === "CodeBlock" && node.children.length > 1) {
                node.name = "CodeGroup";
            }

            if (node.name === "CodeGroup") {
                for (const child of node.children) {
                    if (child == null || child.type !== "element" || child.tagName !== "pre") {
                        return;
                    }

                    const codeNode = child.children[0];
                    if (codeNode == null || codeNode.type !== "element" || codeNode.tagName !== "code") {
                        return;
                    }
                }

                return;
            }
        });

        /**
         * Convert <pre><code>...</code></pre> to <CodeBlock>...</CodeBlock>
         */
        visit(tree, "element", (node, index, parent) => {
            if (node.tagName !== "pre" || parent == null || index == null) {
                return;
            }

            const codeNode = node.children[0];
            if (codeNode == null || codeNode.type !== "element" || codeNode.tagName !== "code") {
                return;
            }

            const language = compact(flatten([codeNode.properties?.className]))
                .find(
                    (className): className is string =>
                        typeof className === "string" && className.startsWith("language-")
                )
                ?.replace("language-", "");

            if (language === "mermaid" && codeNode.children[0]?.type === "text") {
                parent?.children.splice(index, 1, {
                    type: "mdxJsxFlowElement",
                    name: "Mermaid",
                    attributes: [],
                    children: [{ type: "text", value: codeNode.children[0].value }]
                });
                return;
            }

            const meta = codeNode.data?.meta ?? "";
            let replacement: MdastRootContent | undefined;

            try {
                replacement = mdastFromMarkdown(`<CodeBlock ${migrateMeta(meta)} />`, "mdx").children[0];
            } catch (error) {
                console.error(`[rehype-code-block] ${JSON.stringify(error)}`);
                try {
                    // if we fail to parse the meta, just wrap it in a title
                    const props = meta.trim().length === 0 ? "" : `title="${escape(meta)}"`;
                    replacement = mdastFromMarkdown(`<CodeBlock ${props} />`, "mdx").children[0];
                } catch (fallbackError) {
                    console.error(`[rehype-code-block] fallback also failed: ${JSON.stringify(fallbackError)}`);
                    // if even the fallback fails, create a bare CodeBlock with no meta
                    replacement = mdastFromMarkdown("<CodeBlock />", "mdx").children[0];
                }
            }

            if (!replacement || !isMdxJsxElementHast(replacement)) {
                return;
            }

            if (language) {
                replacement.attributes.unshift({
                    type: "mdxJsxAttribute",
                    name: "language",
                    value: language
                });
            }

            replacement.position = codeNode.position;
            replacement.attributes.unshift(
                ...propertiesToMdxJsxAttributes(node.properties),
                ...propertiesToMdxJsxAttributes(codeNode.properties)
            );

            if (codeNode.children[0]?.type === "text" || codeNode.children[0]?.type === "raw") {
                const code = codeNode.children[0].value;
                replacement.attributes.unshift({
                    type: "mdxJsxAttribute",
                    name: "code",
                    value: code
                });
            }

            parent.children[index] = replacement;
            return SKIP;
        });

        /**
         * unravel <CodeBlock><CodeBlock>...</CodeBlock></CodeBlock> into <CodeBlock>...</CodeBlock>
         */
        visit(tree, (node, index, parent) => {
            if (index == null || parent == null || !isMdxJsxElementHast(node) || node.name !== "CodeBlock") {
                return;
            }

            const child = node.children[0];
            if (child && isMdxJsxElementHast(child) && child.name === "CodeBlock") {
                node.attributes = [...node.attributes, ...child.attributes];
                node.children = child.children;
                return [SKIP, index];
            }
            return;
        });
    };
};

export function migrateMeta(metastring: string): string {
    metastring = metastring.trim();

    if (metastring === "") {
        return metastring;
    }

    // migrate {1-3} to {[1, 2, 3]}
    // but do NOT migrate {1} to {[1]}
    metastring = metastring.replaceAll(/\{([0-9,\s-]+)\}/g, (original, expr) => {
        if (expr?.includes(",") || expr?.includes("-")) {
            return `{[${parseNumericRange(expr ?? "")}]}`;
        }
        return original;
    });

    // Strip {key=value} patterns from external toolchains (e.g. pytest-codeblocks' {pytest_codeblocks_skip=true}).
    // These are not valid MDX expressions and would cause acorn parse errors if left as-is.
    // They are not meaningful to the CodeBlock component, so we remove them entirely.
    metastring = metastring.replaceAll(/\{(\w+)=([\w.-]+)\}/g, "").trim();

    // Collect all standalone numeric-range expressions (not preceded by `=`) and merge into a single highlight attribute.
    // This handles cases like `docs.yml {7-8} {14-16}` → `docs.yml highlight={[7,8,14,15,16]}`
    // Also handles bare single-value ranges like `{1}` → `highlight={[1]}`
    const standaloneRanges: string[] = [];
    metastring = metastring.replaceAll(/\{([0-9,\s[\]-]*)\}/g, (original, inner: string, offset: number) => {
        if (metastring.slice(offset + 1, offset + 3) === "...") {
            return original;
        }
        if (offset > 0 && metastring[offset - 1] === "=") {
            return original;
        }
        // Normalize: strip outer square brackets if present, then collect the numbers
        const normalized = inner.startsWith("[") && inner.endsWith("]") ? inner.slice(1, -1) : inner;
        if (normalized.trim() === "") {
            return original;
        }
        standaloneRanges.push(normalized);
        return "";
    });
    if (standaloneRanges.length > 0) {
        const merged = standaloneRanges.flatMap((r) => r.split(",").map((s) => s.trim())).join(",");
        metastring = `${metastring.trim()} highlight={[${merged}]}`;
    }

    // migrate test=123 to test={123}
    metastring = metastring.replaceAll(/=([0-9]+)/g, (_original, expr) => {
        return `={${expr}}`;
    });

    metastring = metastring.replaceAll(/=([a-zA-Z]+)/g, (original, expr) => {
        // don't replace booleans
        if (expr === "true" || expr === "false") {
            return original;
        }
        return `="${expr}"`;
    });

    // migrate "abcd" to title="abcd"
    if (metastring.startsWith('"') && metastring.endsWith('"')) {
        return `title=${metastring}`;
    }

    if (metastring.startsWith("'") && metastring.endsWith("'")) {
        return `title="${metastring.slice(1, -1).replace(/"/g, '\\"')}"`;
    }

    function createMetaWithTitleAttribute(text: string): string {
        const strippedMeta = text
            .replaceAll(/(wordWrap)/g, "")
            .replaceAll(/(for="(.*?)")/g, "")
            .trim();
        if (strippedMeta.length === 0) {
            return text;
        }

        return text.replace(strippedMeta, `title="${strippedMeta.replace(/"/g, '\\"')}"`);
    }

    // migrate abcd to title="abcd"
    // exclude any characters wrapped in {}
    if (
        !metastring.includes("={") &&
        !metastring.includes('="') &&
        !metastring.includes("{...") &&
        !/\{[^}]*[a-zA-Z][^}]*\}/.test(metastring)
    ) {
        return createMetaWithTitleAttribute(metastring);
    }

    metastring = metastring.replaceAll(/^([^{]*?)(?=[a-zA-Z]+=)/g, (_original, text) => {
        if (text.trim() === "") {
            return "";
        }

        return createMetaWithTitleAttribute(text);
    });

    // if a title hasn't been found so far, make sure it is not hidden in meta string
    if (!metastring.includes("title=")) {
        // ignore special words, anything in curly braces
        const parseForTitle = metastring
            .replaceAll(/(wordWrap)/g, "")
            .replaceAll(/(for="(.*?)")/g, "")
            .replaceAll(/([^=]+)={(.*?)}/g, "")
            .replaceAll(/{(.*?)}/g, "");
        if (parseForTitle !== "") {
            metastring = metastring.replace(parseForTitle, ` title="${parseForTitle.trim()}" `);
        }
    }

    return metastring;
}
