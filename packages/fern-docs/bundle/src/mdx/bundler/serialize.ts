import "server-only";

import { after } from "next/server";

import { kv } from "@vercel/kv";
import { createHash } from "crypto";
import { mapKeys } from "es-toolkit/object";
import fs from "fs";
import { gracefulify } from "graceful-fs";
import { bundleMDX } from "mdx-bundler";
import path from "path";
import rehypeKatex from "rehype-katex";
import remarkFrontmatter from "remark-frontmatter";
import remarkGemoji from "remark-gemoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkSmartypants from "remark-smartypants";
import remarkSqueezeParagraphs from "remark-squeeze-paragraphs";
import { noop } from "ts-essentials";

import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { postToSlack } from "@fern-api/docs-server/slack";
import { isDevelopment, isPreviewDomain } from "@fern-api/docs-utils";
import { FileData } from "@fern-api/docs-utils/types/file-data";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import { Hast, type PluggableList, customHeadingHandler, sanitizeBreaks, sanitizeMdxExpression } from "@fern-docs/mdx";
import {
    rehypeAcornErrorBoundary,
    rehypeExpressionToMd,
    rehypeMdxClassStyle,
    rehypeSlug,
    rehypeToc,
    remarkInjectEsm,
    remarkSanitizeAcorn
} from "@fern-docs/mdx/plugins";

import { getMDXExport } from "../get-mdx-export";
import { rehypeAccordionNestedHeaders } from "../plugins/rehype-accordion-nested-headers";
import { rehypeAccordions } from "../plugins/rehype-accordions";
import { rehypeButtons } from "../plugins/rehype-buttons";
import { rehypeCards } from "../plugins/rehype-cards";
import { rehypeCodeBlock } from "../plugins/rehype-code-block";
import { rehypeCollectJsx } from "../plugins/rehype-collect-jsx";
import { rehypeEndpointExampleSnippets } from "../plugins/rehype-endpoint-example-snippets";
import { rehypeEndpointSchemaSnippets } from "../plugins/rehype-endpoint-schema-snippet";
import { rehypeExtractAsides } from "../plugins/rehype-extract-asides";
import { rehypeFiles } from "../plugins/rehype-files";
import { RehypeLinksOptions, rehypeLinks } from "../plugins/rehype-links";
import { rehypeMigrateJsx } from "../plugins/rehype-migrate-jsx";
import { rehypeParamField } from "../plugins/rehype-param-field";
import { rehypeSteps } from "../plugins/rehype-steps";
import { rehypeTable } from "../plugins/rehype-table";
import { rehypeTabs } from "../plugins/rehype-tabs";
import { remarkExtractTitle } from "../plugins/remark-extract-title";

// gracefulify fs to avoid EMFILE errors on Vercel
gracefulify(fs);

const TWOSLASH_TIMEOUT = 240_000;
const SERIALIZATION_TIMEOUT = 10_000;

export interface SerializeMdxResponse {
    code: string;
    frontmatter?: Partial<FernDocs.Frontmatter>;
    jsxElements: string[];
    scope?: Record<string, unknown>;
    engine: "next-remote" | "esbuild";
}

async function serializeMdxImpl(
    content: string,
    {
        loader,
        filename,
        scope,
        toc = false,
        replaceHref
    }: {
        loader?: Partial<Pick<DocsLoader, "getFiles" | "getMdxBundlerFiles">>;
        scope?: Record<string, unknown>;
        filename?: string;
        toc?: boolean;
        replaceHref?: RehypeLinksOptions["replaceHref"];
    } = {},
    domain: string
): Promise<SerializeMdxResponse> {
    content = sanitizeBreaks(content);
    content = sanitizeMdxExpression(content)[0];

    const startTime = Date.now();
    console.log("[serializeMdx] processing twoslash...");
    const processedContent = await processTwoslashBlocks(content);
    console.log("[serializeMdx] processing twoslash took ", Date.now() - startTime, "ms");

    let cwd: string | undefined;
    if (filename != null) {
        try {
            cwd = path.dirname(filename);
        } catch {
            console.error("Failed to get cwd from filename", filename);
        }
    }

    if (process.platform === "win32") {
        process.env.ESBUILD_BINARY_PATH = path.join(process.cwd(), "node_modules", "esbuild", "esbuild.exe");
    } else {
        process.env.ESBUILD_BINARY_PATH = path.join(process.cwd(), "node_modules", "esbuild", "bin", "esbuild");
    }

    let files: Record<string, string> = {};
    let remoteFiles: Record<string, FileData> = {};
    const jsxElements: string[] = [];

    remoteFiles = (await loader?.getFiles?.()) ?? {};
    files = (await loader?.getMdxBundlerFiles?.()) ?? {};
    files = mapKeys(files ?? {}, (_file, filename) => {
        if (cwd != null) {
            return path.relative(cwd, filename);
        }
        return filename;
    });

    const createBundleConfig = (source: string) => ({
        source,
        files,
        globals: {
            "@mdx-js/react": {
                varName: "MdxJsReact",
                namedExports: ["useMDXComponents"],
                defaultExport: false
            }
        },
        mdxOptions: (o: any) => {
            o.remarkRehypeOptions = {
                handlers: { heading: customHeadingHandler }
            };

            o.providerImportSource = "@mdx-js/react";

            const remarkPlugins: PluggableList = [
                remarkFrontmatter,
                remarkExtractTitle,
                [remarkMdxFrontmatter, { name: "frontmatter" }],
                remarkSqueezeParagraphs,
                [remarkInjectEsm, { scope }],
                [remarkSanitizeAcorn],
                remarkGfm,
                remarkSmartypants,
                remarkMath,
                remarkGemoji
            ];

            const rehypePlugins: PluggableList = [
                rehypeKatex,
                [rehypeFiles, { files: remoteFiles }],
                rehypeMdxClassStyle,
                rehypeCodeBlock,
                rehypeSteps,
                rehypeAccordions,
                rehypeTable,
                rehypeTabs,
                rehypeCards,
                rehypeParamField,
                [rehypeSlug, { additionalJsxElements: ["Step", "Accordion", "Tab", "ParamField"] }],
                [rehypeLinks, { replaceHref }],
                rehypeAccordionNestedHeaders,
                [
                    rehypeExpressionToMd,
                    {
                        mdxJsxElementAllowlist: {
                            Frame: ["caption"],
                            Tab: ["title"],
                            Card: ["title"],
                            Callout: ["title"],
                            Info: ["title"],
                            Warning: ["title"],
                            Success: ["title"],
                            Error: ["title"],
                            Note: ["title"],
                            Launch: ["title"],
                            Tip: ["title"],
                            Check: ["title"],
                            Step: ["title"],
                            Accordion: ["title"]
                        }
                    }
                ],
                rehypeButtons,
                [rehypeEndpointSchemaSnippets, { loader }],
                [rehypeEndpointExampleSnippets, { loader }],
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
                toc ? rehypeToc : noop,
                rehypeAcornErrorBoundary,
                [
                    rehypeCollectJsx,
                    {
                        collect: (jsxElements_: string[]) => {
                            jsxElements.push(...jsxElements_);
                        }
                    }
                ],
                rehypeExtractAsides,
                rehypeLog
            ];

            o.remarkPlugins = remarkPlugins;
            o.rehypePlugins = rehypePlugins;
            o.development = process.env.NODE_ENV === "development";

            return o;
        },
        esbuildOptions: (o: any) => {
            o.minify = process.env.NODE_ENV === "production";
            o.sourcemap = false;
            o.logLevel = "error";
            o.logLimit = 0;
            o.metafile = false;
            o.write = false;

            const restrictedDefine = {
                "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV)
            };

            o.define = restrictedDefine;
            o.inject = o.inject?.filter((path: string) => !path.includes("process"));

            return o;
        }
    });

    let bundled: Awaited<ReturnType<typeof bundleMDX>> | null = null;
    let lastError: Error | null = null;

    // try with processedContent first, then fallback to original content
    const sources = [processedContent, content];

    for (const source of sources) {
        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("BundleMDX timed out after 5 seconds")), 5_000)
            );

            bundled = await Promise.race([bundleMDX(createBundleConfig(source)), timeoutPromise]);
            break;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(
                `BundleMDX failed with ${source === processedContent ? "processed" : "original"} content:`,
                lastError.message
            );
        }
    }

    if (!bundled) {
        throw lastError || new Error("BundleMDX failed with all retry attempts");
    }

    if (bundled.errors.length > 0) {
        bundled.errors.forEach((error) => {
            if (!isPreviewDomain(domain) && !isDevelopment(domain)) {
                postToSlack(
                    "#docs-notifs",
                    `:rotating_light: Error serializing mdx for ${domain}${path ? "/" + path : ""} with ${String(error)}`,
                    "mdx-serializer",
                    { message: processedContent, mrkdwn: true }
                );
            }
            console.error(`[serializer:bundle-mdx] ${JSON.stringify(error)}`);
        });
        console.debug("content", processedContent, "code", bundled.code);
    }

    const frontmatter = getMDXExport(bundled)?.frontmatter as Partial<FernDocs.Frontmatter> | undefined;

    // TODO: this is doing duplicate work; figure out how to combine it with the compiler above.
    // const { jsxElements } = toTree(content, { sanitize: false });

    return { code: bundled.code, frontmatter, jsxElements, engine: "esbuild" };
}

export function serializeMdx(
    content: string | undefined,
    options?: Parameters<typeof serializeMdxImpl>[1],
    domain?: string
): Promise<SerializeMdxResponse | undefined> {
    const abortController = new AbortController();
    const { signal } = abortController;

    return new Promise<SerializeMdxResponse | undefined>((resolve, reject) => {
        if (!content?.trimStart().length) {
            resolve(undefined);
            return;
        }

        let serializeTimeout = SERIALIZATION_TIMEOUT;
        if (content.includes("twoslash")) {
            serializeTimeout = TWOSLASH_TIMEOUT;
        }

        const timeoutId = setTimeout(() => {
            if (!signal.aborted) {
                abortController.abort();
                console.error(`Serialize MDX timed out after ${serializeTimeout / 1000} seconds`);
                reject(new Error("Serialize MDX timed out"));
            }
        }, serializeTimeout);

        serializeMdxImpl(content, { ...options }, domain ?? "").then(
            (result) => {
                clearTimeout(timeoutId);
                resolve(result);
            },
            (error: unknown) => {
                clearTimeout(timeoutId);
                reject(error instanceof Error ? error : new Error(String(error)));
                console.error(`[serialize:serialize-mdx] ${JSON.stringify(error)}`);
            }
        );
    });
}

// uncomment this to log the tree to the console in localhost only (DO NOT COMMIT)
function rehypeLog() {
    return (_tree: Hast.Root) => {
        // console.debug(JSON.stringify(tree));
    };
}
function getMdxBundlerService() {
    return process.env.NEXT_PUBLIC_MDX_BUNDLER_ORIGIN ?? "https://mdx-bundler-dev2.buildwithfern.com";
}

// if no domain is provided, store in a twoslash cache
// if block fails to process, returns the original code, unformatted
export async function processTwoslashBlocks(content: string): Promise<string> {
    if (!content.includes("twoslash") || process.env.NEXT_PUBLIC_TWOSLASH_ENABLED !== "1") {
        return content;
    }

    const originalContent = content;

    // check for twoslash anywhere in the code meta
    const twoslashRegex = /(?:[ \t]*)```(?:ts|tsx)(?:[^`\n]*?)twoslash(?:[^`\n]*?)\n([\s\S]*?)\n(?:[ \t]*)```/g;
    const twoslashBlocks: { fullMatch: string; codeContent: string }[] = [];

    let match;
    while ((match = twoslashRegex.exec(originalContent)) != null) {
        if (match[0] && match[1]) {
            const fullMatch = match[0];
            const codeContent = match[1].trim();
            const endIndex = fullMatch.lastIndexOf("```");
            const actualFullMatch = fullMatch.substring(0, endIndex + 3);

            twoslashBlocks.push({
                fullMatch: actualFullMatch,
                codeContent
            });
        }
    }

    if (twoslashBlocks.length === 0) {
        return content;
    }

    // Process all blocks within TwoSlash timeout limit (leave time for serialization fallback)
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
            () => reject(new Error("TwoSlash processing timed out after 200 seconds")),
            TWOSLASH_TIMEOUT - SERIALIZATION_TIMEOUT
        )
    );

    try {
        await Promise.race([
            Promise.all(
                twoslashBlocks.map(async (block) => {
                    const ignoreErrors = block.codeContent.includes("noErrors") ? "" : "// @noErrors\n";

                    const serviceContent = `\`\`\`${block.fullMatch.includes("tsx") ? "tsx" : "ts"} twoslash\n${ignoreErrors}${block.codeContent}\n\`\`\``;

                    try {
                        let result;
                        const cached = await kvGet(block.codeContent);

                        if (cached != null) {
                            result = cached.value;
                        } else {
                            console.log("Sending request to serialize service...");
                            const response = await fetch(`${getMdxBundlerService()}/serialize`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ code: serviceContent })
                            });

                            if (!response.ok) {
                                console.error("Serialize service returned error:", response.statusText);
                                throw new Error(`Failed to serialize TwoSlash: ${response.statusText}`);
                            }

                            result = await response.json();
                            kvSet(block.codeContent, result);
                        }

                        // Replace only this specific block
                        const twoSlashContent = `<TwoSlash content={${JSON.stringify({ ...result, value: block.codeContent })}} />`;
                        content = content.replace(block.fullMatch, twoSlashContent);
                    } catch (error) {
                        console.error("Error processing twoslash block:", error);
                        return originalContent;
                    }
                })
            ),
            timeoutPromise
        ]);
    } catch (error) {
        console.error("TwoSlash processing timed out:", error);
        return originalContent;
    }

    if (content.includes("<CodeBlocks>") && content.includes("<TwoSlash")) {
        return removeCodeBlocks(content);
    }

    return content;
}

const removeCodeBlocks = (content: string): string => {
    const lines = content.split("\n");
    const twoSlashIndices: number[] = [];

    // find all instances
    lines.forEach((line, index) => {
        if (line.includes("<TwoSlash")) {
            twoSlashIndices.push(index);
        }
    });

    // process each instance in reverse order to maintain correct indices
    for (const twoSlashLineIndex of twoSlashIndices.reverse()) {
        let topLine = null;
        let bottomLine = null;
        let codeBlockDepth = 0;

        // look backwards for opening tag
        for (let i = twoSlashLineIndex; i >= 0; i--) {
            const line = lines[i]?.trim();
            if (!line) continue;

            if (line === "<CodeBlocks>") {
                if (codeBlockDepth === 0) {
                    topLine = i;
                    break;
                }
            } else if (line === "</CodeBlocks>") {
                codeBlockDepth++;
            } else if (line.includes("```")) {
                // skip over code blocks
                while (i >= 0 && !lines[i]?.trim().includes("```")) {
                    i--;
                }
            }
        }

        codeBlockDepth = 0;

        // look forwards for closing tag
        for (let i = twoSlashLineIndex; i < lines.length; i++) {
            const line = lines[i]?.trim();
            if (!line) continue;

            if (line === "</CodeBlocks>") {
                if (codeBlockDepth === 0) {
                    bottomLine = i;
                    break;
                }
                codeBlockDepth--;
            } else if (line === "<CodeBlocks>") {
                codeBlockDepth++;
            } else if (line.includes("```")) {
                // skip over code blocks
                while (i < lines.length && !lines[i]?.trim().includes("```")) {
                    i++;
                }
            }
        }

        if (bottomLine != null && topLine != null) {
            lines.splice(bottomLine, 1);
            lines.splice(topLine, 1);
        }
    }

    return lines.join("\n");
};

const TWOSLASH_SEMANTIC_VERSION = "1";

function hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
}

function kvSet(key: string, value: unknown) {
    if (isLocal() || isSelfHosted()) {
        return;
    }

    after(async () => {
        try {
            const hashedKey = hashKey(key);
            await kv.hset("twoslash", {
                [hashedKey]: {
                    value: value,
                    version: TWOSLASH_SEMANTIC_VERSION,
                    createdAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.warn(`Failed to set kv key ${key}: ${value}`, error);
        }
    });
}

async function kvGet(key: string): Promise<Record<string, string> | null> {
    if (isLocal() || isSelfHosted()) {
        return null;
    }

    try {
        const hashedKey = hashKey(key);
        const cached = await kv.hget<Record<string, string>>("twoslash", hashedKey);
        if (cached && cached.version === TWOSLASH_SEMANTIC_VERSION) {
            return cached;
        }

        console.debug(`Could not find key ${hashedKey}. Using MDX service instead...`);
        return null;
    } catch (error) {
        console.warn(`Failed to get kv key ${key}`, error);
        return null;
    }
}
