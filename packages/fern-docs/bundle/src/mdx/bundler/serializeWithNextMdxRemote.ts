import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import { serialize } from "@fern-api/next-mdx-remote/serialize";
import {
    customHeadingHandler,
    getFrontmatter,
    type PluggableList,
    sanitizeBreaks,
    sanitizeMdxExpression,
    toTree
} from "@fern-docs/mdx";
import {
    rehypeAcornErrorBoundary,
    rehypeCodeBlock,
    rehypeExpressionToMd,
    rehypeMdxClassStyle,
    rehypeSlug,
    rehypeSqueezeParagraphs,
    remarkSanitizeAcorn
} from "@fern-docs/mdx/plugins";
import rehypeKatex from "rehype-katex";
import remarkGemoji from "remark-gemoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSmartypants from "remark-smartypants";
import { rehypeAccordionNestedHeaders } from "../plugins/rehype-accordion-nested-headers";
import { rehypeAccordions } from "../plugins/rehype-accordions";
import { rehypeButtons } from "../plugins/rehype-buttons";
import { rehypeCards } from "../plugins/rehype-cards";
import { rehypeExtractStyles } from "../plugins/rehype-extract-styles";
import { rehypeFiles } from "../plugins/rehype-files";
import { type RehypeLinksOptions, rehypeLinks } from "../plugins/rehype-links";
import { rehypeMigrateJsx } from "../plugins/rehype-migrate-jsx";
import { rehypeParamField } from "../plugins/rehype-param-field";
import { rehypeSteps } from "../plugins/rehype-steps";
import { rehypeTable } from "../plugins/rehype-table";
import { rehypeTabs } from "../plugins/rehype-tabs";
import { rehypeExtractAsides } from "../plugins/rehypeExtractAsides";
import { remarkExtractTitle } from "../plugins/remark-extract-title";
import type { SerializeMdxResponse } from "./serialize";

type SerializeOptions = NonNullable<Parameters<typeof serialize>[1]>;

function withDefaultMdxOptions(
    frontmatter: FernDocs.Frontmatter,
    files: Record<string, FileData>,
    replaceHref?: RehypeLinksOptions["replaceHref"],
    collectStyles?: (styles: string[]) => void
): SerializeOptions["mdxOptions"] {
    const remarkRehypeOptions = {
        handlers: {
            heading: customHeadingHandler
        }
    };

    const remarkPlugins: PluggableList = [
        [remarkExtractTitle, { frontmatter }],
        remarkSanitizeAcorn,
        remarkGfm,
        remarkSmartypants,
        remarkMath,
        remarkGemoji
    ];

    const rehypePlugins: PluggableList = [
        rehypeSqueezeParagraphs,
        rehypeKatex,
        [rehypeFiles, { files }],
        rehypeMdxClassStyle,
        rehypeCodeBlock,
        rehypeSteps,
        rehypeAccordions,
        rehypeTabs,
        rehypeTable,
        rehypeCards,
        rehypeParamField,
        [rehypeSlug, { additionalJsxElements: ["Step", "Accordion", "Tab", "ParamField"] }],
        [rehypeLinks, { replaceHref }],
        ...(collectStyles
            ? ([
                  [
                      rehypeExtractStyles,
                      {
                          collect: collectStyles
                      }
                  ]
              ] as PluggableList)
            : []),
        rehypeAccordionNestedHeaders,
        [
            rehypeExpressionToMd,
            {
                mdxJsxElementAllowlist: {
                    Frame: ["caption"],
                    Tab: ["title"],
                    Card: ["title"],
                    Callout: ["title"],
                    Step: ["title"],
                    Accordion: ["title"]
                }
            }
        ],
        rehypeButtons,
        [
            rehypeMigrateJsx,
            {
                a: "A",
                h1: "H1",
                h2: "H2",
                h3: "H3",
                h4: "H4",
                h5: "H5",
                h6: "H6",
                img: "Image",
                iframe: "IFrame",
                li: "Li",
                ol: "Ol",
                strong: "Strong",
                table: "Table",
                ul: "Ul"
            }
        ],
        rehypeAcornErrorBoundary,
        rehypeExtractAsides
    ];

    // right now, only pages use frontmatterDefaults, so when null, it is implicit that we're serializing a description.
    // if (frontmatterDefaults != null) {
    //     rehypePlugins.push([rehypeFernLayout, { matter: frontmatterDefaults }]);
    // }

    return {
        /**
         * development=true is required to render MdxRemote from the client-side.
         * https://github.com/hashicorp/next-mdx-remote/issues/350
         */
        development: process.env.NODE_ENV !== "production",
        remarkRehypeOptions,
        remarkPlugins,
        rehypePlugins,
        format: "mdx",
        useDynamicImport: true
    };
}

/**
 * Should only be invoked server-side.
 */
export async function serializeMdxImpl(
    content: string,
    {
        loader,
        scope,
        replaceHref
    }: {
        loader?: Partial<Pick<DocsLoader, "getFiles" | "getMdxBundlerFiles">>;
        scope?: Record<string, unknown>;
        replaceHref?: RehypeLinksOptions["replaceHref"];
    } = {}
): Promise<SerializeMdxResponse> {
    content = sanitizeBreaks(content);
    content = sanitizeMdxExpression(content)[0];

    const styles: string[] = [];

    try {
        const { data: frontmatter, content: contentWithoutFrontmatter } = getFrontmatter(content);

        const files = (await loader?.getFiles?.()) ?? {};

        const result = await serialize<Record<string, unknown>, FernDocs.Frontmatter>(contentWithoutFrontmatter, {
            mdxOptions: withDefaultMdxOptions(frontmatter, files, replaceHref, (styles_: string[]) => {
                styles.push(...styles_);
            }),
            parseFrontmatter: false // this is parsed above via getFrontmatter
        });

        // TODO: this is doing duplicate work; figure out how to combine it with the compiler above.
        const { jsxElements } = toTree(content, { sanitize: false });

        return {
            code: result.compiledSource,
            frontmatter: frontmatter,
            jsxElements,
            scope: scope ?? {},
            engine: "next-remote",
            styles
        };
    } catch (e) {
        // TODO: sentry

        console.error("Failed to serialize MDX content", e);

        return {
            code: content,
            frontmatter: {},
            jsxElements: [],
            scope: scope ?? {},
            engine: "next-remote",
            styles: []
        };
    }
}
