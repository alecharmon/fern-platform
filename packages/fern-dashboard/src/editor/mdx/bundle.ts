import { bundleMDX as internalBundleMDX } from "mdx-bundler";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";

import { rehypeCodeBlock } from "@fern-docs/mdx/plugins";
import { rehypeEditorComponents } from "./plugins/rehype-editor-components";
import { rehypeEndpointExampleSnippets } from "./plugins/rehype-endpoint-example-snippets";
import { rehypeEndpointSchemaSnippets } from "./plugins/rehype-endpoint-schema-snippets";

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
            const rehypePlugins = [
                ...(options.rehypePlugins ?? []),
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

            options.rehypePlugins = rehypePlugins;
            return options;
        }
    });

    return { code };
}
