import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { rehypeCodeBlock, rehypeMdxClassStyle } from "@fern-docs/mdx/plugins";
import { bundleMDX as internalBundleMDX } from "mdx-bundler";
import { rehypeEditorComponents } from "./plugins/rehype-editor-components";
import { rehypeEndpointExampleSnippets } from "./plugins/rehype-endpoint-example-snippets";
import { rehypeEndpointSchemaSnippets } from "./plugins/rehype-endpoint-schema-snippets";

/**
 * Remark plugin to strip imports from MDX since we can't resolve them in the editor
 */
function remarkStripImports() {
    return (tree: any) => {
        tree.children = tree.children.filter((node: any) => {
            // Remove mdxjsEsm nodes which represent imports and exports
            return node.type !== "mdxjsEsm";
        });
    };
}

export async function bundleMDX(
    source: string,
    options?: {
        loader?: DocsLoader;
    }
) {
    const { loader } = options ?? {};

    const { code } = await internalBundleMDX({
        source,
        mdxOptions: (options) => {
            const remarkPlugins = [
                ...(options.remarkPlugins ?? []),
                // Strip imports since we can't resolve them in the editor
                remarkStripImports
            ];

            const rehypePlugins = [
                ...(options.rehypePlugins ?? []),
                // Convert HTML attributes to JSX (class -> className, style string -> style object)
                rehypeMdxClassStyle,
                // Add code block conversion plugin to transform <pre><code> into <CodeBlock>
                rehypeCodeBlock,
                // Add loader-dependent plugins if loader is available
                ...(loader
                    ? [
                          [rehypeEndpointSchemaSnippets, { loader }],
                          [rehypeEndpointExampleSnippets, { loader }]
                      ]
                    : []),
                // Always add editor components plugin last to ensure proper component name conversion
                rehypeEditorComponents
            ];

            options.remarkPlugins = remarkPlugins;
            options.rehypePlugins = rehypePlugins;
            return options;
        }
    });

    return { code };
}
