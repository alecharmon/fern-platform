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
import { rehypeAccordions } from "../plugins/rehype-accordions";
import { rehypeApiLinks, sanitizeApiLinks } from "../plugins/rehype-api-links";
import { rehypeButtons } from "../plugins/rehype-buttons";
import { rehypeCards } from "../plugins/rehype-cards";
import { rehypeExtractStyles } from "../plugins/rehype-extract-styles";
import { rehypeFiles } from "../plugins/rehype-files";
import { rehypeInlineFaIcons } from "../plugins/rehype-inline-fa-icons";
import { type RehypeLinksOptions, rehypeLinks } from "../plugins/rehype-links";
import { rehypeLlmsFilter } from "../plugins/rehype-llms-filter";
import { rehypeMigrateJsx } from "../plugins/rehype-migrate-jsx";
import { rehypeAccordionNestedHeaders, rehypeTabNestedHeaders } from "../plugins/rehype-nested-headers";
import { rehypeParamField } from "../plugins/rehype-param-field";
import { rehypeSchema } from "../plugins/rehype-schema";
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
    collectStyles?: (styles: string[]) => void,
    loader?: DocsLoader
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
        rehypeInlineFaIcons,
        rehypeKatex,
        [rehypeFiles, { files }],
        rehypeMdxClassStyle,
        rehypeLlmsFilter,
        rehypeCodeBlock,
        rehypeSteps,
        rehypeAccordions,
        rehypeTabs,
        rehypeTable,
        rehypeCards,
        rehypeParamField,
        [rehypeSlug, { additionalJsxElements: ["Step", "Accordion", "Tab", "ParamField"] }],
        [rehypeLinks, { replaceHref }],
        ...(loader ? ([[rehypeApiLinks, { loader }]] as PluggableList) : []),
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
        rehypeTabNestedHeaders,
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
        // Add rehypeSchema to pre-serialize type definitions in Schema components
        ...(loader ? ([[rehypeSchema, { loader }]] as PluggableList) : []),
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
        loader?: DocsLoader;
        scope?: Record<string, unknown>;
        replaceHref?: RehypeLinksOptions["replaceHref"];
    } = {}
): Promise<SerializeMdxResponse> {
    content = sanitizeBreaks(content);
    content = sanitizeMdxExpression(content)[0];
    content = sanitizeApiLinks(content);

    const styles: string[] = [];

    try {
        const { data: frontmatter, content: contentWithoutFrontmatter } = getFrontmatter(content);

        const files = (await loader?.getFiles?.()) ?? {};

        const result = await serialize<Record<string, unknown>, FernDocs.Frontmatter>(contentWithoutFrontmatter, {
            mdxOptions: withDefaultMdxOptions(
                frontmatter,
                files,
                replaceHref,
                (styles_: string[]) => {
                    styles.push(...styles_);
                },
                loader
            ),
            parseFrontmatter: false // this is parsed above via getFrontmatter
        });

        // TODO: this is doing duplicate work; figure out how to combine it with the compiler above.
        const { jsxElements } = toTree(contentWithoutFrontmatter, { sanitize: false });

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
