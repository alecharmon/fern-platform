import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import { serialize } from "@fern-api/next-mdx-remote/serialize";
import type { SerializedDescription } from "@fern-docs/components/api-reference/type-definitions/serialized-types";
import {
    customHeadingHandler,
    getFrontmatter,
    type PluggableList,
    sanitizeBreaks,
    sanitizeMdxExpression,
    toTree
} from "@fern-docs/mdx";

// Re-export type from components for consumers
export type { SerializedDescription };

import {
    rehypeAcornErrorBoundary,
    rehypeCodeBlock,
    rehypeMdxClassStyle,
    rehypeSqueezeParagraphs,
    remarkSanitizeAcorn
} from "@fern-docs/mdx/plugins";
import rehypeKatex from "rehype-katex";
import remarkGemoji from "remark-gemoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSmartypants from "remark-smartypants";

import { rehypeMigrateJsx } from "./rehype-migrate-jsx";

type SerializeOptions = NonNullable<Parameters<typeof serialize>[1]>;

/**
 * Minimal MDX options for serializing descriptions.
 * This is a simplified version that doesn't include plugins that could cause
 * recursion or are unnecessary for descriptions (like Schema, EndpointSchema, etc.)
 */
function getDescriptionMdxOptions(): SerializeOptions["mdxOptions"] {
    const remarkRehypeOptions = {
        handlers: {
            heading: customHeadingHandler
        }
    };

    const remarkPlugins: PluggableList = [remarkSanitizeAcorn, remarkGfm, remarkSmartypants, remarkMath, remarkGemoji];

    const rehypePlugins: PluggableList = [
        rehypeSqueezeParagraphs,
        rehypeKatex,
        rehypeMdxClassStyle,
        rehypeCodeBlock,
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
                strong: "Strong",
                ul: "Ul",
                ol: "Ol",
                li: "Li"
            }
        ],
        rehypeAcornErrorBoundary
    ];

    return {
        development: process.env.NODE_ENV !== "production",
        remarkRehypeOptions,
        remarkPlugins,
        rehypePlugins,
        format: "mdx",
        useDynamicImport: true
    };
}

/**
 * A lightweight serializer for descriptions within type definitions.
 * This avoids the full serialization pipeline and specifically excludes
 * plugins like rehypeSchema to prevent circular references.
 */
export async function serializeDescription(content: string | undefined): Promise<SerializedDescription | undefined> {
    if (!content || content.trim().length === 0) {
        return undefined;
    }

    // Quick check for plain text - no need to serialize
    const isPlainText = /^[a-zA-Z0-9\s.,'"!?-]*$/.test(content);

    if (isPlainText) {
        return {
            code: content,
            jsxElements: [],
            engine: "plaintext"
        };
    }

    try {
        let sanitized = sanitizeBreaks(content);
        sanitized = sanitizeMdxExpression(sanitized)[0];

        const { content: contentWithoutFrontmatter } = getFrontmatter(sanitized);

        const result = await serialize<Record<string, unknown>, FernDocs.Frontmatter>(contentWithoutFrontmatter, {
            mdxOptions: getDescriptionMdxOptions(),
            parseFrontmatter: false
        });

        const { jsxElements } = toTree(content, { sanitize: false });

        return {
            code: result.compiledSource,
            jsxElements,
            engine: "next-remote"
        };
    } catch (e) {
        console.error("Failed to serialize description:", e);
        // Return the raw content as fallback
        return {
            code: content,
            jsxElements: [],
            engine: "plaintext"
        };
    }
}
