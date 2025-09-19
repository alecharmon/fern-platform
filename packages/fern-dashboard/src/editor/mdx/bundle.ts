import { bundleMDX as internalBundleMDX } from "mdx-bundler";

import { rehypeEditorComponents } from "./plugins/rehype-editor-components";

export async function bundleMDX(source: string) {
  const { code } = await internalBundleMDX({
    source,
    mdxOptions: (options) => {
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        rehypeEditorComponents,
      ];
      return options;
    },
  });

  return { code };
}
