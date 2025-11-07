import { isToc, type TableOfContentsItem } from "@fern-docs/mdx";
import { getMDXExport as getMDXExportOriginal, type MDXContentProps } from "mdx-bundler/client";

export function getMDXExport(
    mdx: { code: string; engine?: "esbuild" | "next-remote" | "plaintext" } | undefined,
    useMDXComponents: () => any = () => ({})
):
    | {
          ["default"]: React.ComponentType<MDXContentProps>;
          [key: string]: unknown;
      }
    | undefined {
    if (mdx == null) {
        return undefined;
    }

    if (typeof mdx === "string") {
        return undefined;
    }

    if (mdx.engine === "plaintext") {
        return undefined;
    }

    return getMDXExportOriginal(mdx.code, {
        // allows us to use MDXProvider to pass components to children
        MdxJsReact: { useMDXComponents }
    });
}

export function asToc(unknown: unknown): TableOfContentsItem[] {
    if (isToc(unknown)) {
        return unknown;
    }
    return [];
}
