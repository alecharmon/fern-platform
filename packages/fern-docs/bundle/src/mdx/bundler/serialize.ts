import "server-only";

import { createKvCache } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { isDocsDev } from "@fern-api/docs-server/isDocsDev";
import { postToSlack } from "@fern-api/docs-server/slack";
import { isDevelopment, isPreviewDomain } from "@fern-api/docs-utils";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import {
    customHeadingHandler,
    type Hast,
    type PluggableList,
    sanitizeBreaks,
    sanitizeMdxExpression
} from "@fern-docs/mdx";
import {
    rehypeAcornErrorBoundary,
    rehypeCodeBlock,
    rehypeExpressionToMd,
    rehypeMdxClassStyle,
    rehypeSlug,
    rehypeSqueezeParagraphs,
    rehypeToc,
    remarkInjectEsm,
    remarkSanitizeAcorn
} from "@fern-docs/mdx/plugins";
import { createHash } from "crypto";
import { mapKeys } from "es-toolkit/object";
import fs from "fs";
import { gracefulify } from "graceful-fs";
import { bundleMDX } from "mdx-bundler";
import path from "path";
import rehypeKatex from "rehype-katex";
import rehypeRemoveComments from "rehype-remove-comments";
import remarkFrontmatter from "remark-frontmatter";
import remarkGemoji from "remark-gemoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkSmartypants from "remark-smartypants";
import remarkSqueezeParagraphs from "remark-squeeze-paragraphs";
import { noop } from "ts-essentials";
import { getMDXExport } from "../get-mdx-export";
import { rehypeAccordionNestedHeaders } from "../plugins/rehype-accordion-nested-headers";
import { rehypeAccordions } from "../plugins/rehype-accordions";
import { rehypeButtons } from "../plugins/rehype-buttons";
import { rehypeCards } from "../plugins/rehype-cards";
import { rehypeCollectJsx } from "../plugins/rehype-collect-jsx";
import { rehypeEndpointExampleSnippets } from "../plugins/rehype-endpoint-example-snippets";
import { rehypeEndpointSchemaSnippets } from "../plugins/rehype-endpoint-schema-snippet";
import { rehypeExtractAsides } from "../plugins/rehype-extract-asides";
import { rehypeExtractStyles } from "../plugins/rehype-extract-styles";
import { rehypeFiles } from "../plugins/rehype-files";
import { rehypeLang } from "../plugins/rehype-lang";
import { type RehypeLinksOptions, rehypeLinks } from "../plugins/rehype-links";
import { rehypeLlmsFilter } from "../plugins/rehype-llms-filter";
import { rehypeMigrateJsx } from "../plugins/rehype-migrate-jsx";
import { rehypeParamField } from "../plugins/rehype-param-field";
import { rehypeRunnableEndpoint } from "../plugins/rehype-runnable-endpoint";
import { rehypeSchema } from "../plugins/rehype-schema";
import { rehypeSteps } from "../plugins/rehype-steps";
import { rehypeTable } from "../plugins/rehype-table";
import { rehypeTabs } from "../plugins/rehype-tabs";
import { rehypeWebhookPayloadSnippet } from "../plugins/rehype-webhook-payload-snippet";
import { remarkExtractTitle } from "../plugins/remark-extract-title";
import { trackCustomComponents } from "./track-custom-components";

// gracefulify fs to avoid EMFILE errors on Vercel
gracefulify(fs);

const TWOSLASH_TIMEOUT = 240_000;
const SERIALIZATION_TIMEOUT = 50_000;
const BUNDLE_MDX_TIMEOUT = 50_000;

// Create KV cache instance for TwoSlash code transformation caching
const kvCache = createKvCache(isDocsDev());

export interface SerializeMdxResponse {
    code: string;
    frontmatter?: Partial<FernDocs.Frontmatter>;
    jsxElements: string[];
    scope?: Record<string, unknown>;
    engine: "next-remote" | "esbuild" | "plaintext";
    styles?: string[];
}

async function serializeMdxImpl(
    content: string,
    {
        loader,
        filename,
        scope,
        toc = false,
        replaceHref,
        org,
        domain,
        slug
    }: {
        loader?: Partial<Pick<DocsLoader, "getFiles" | "getMdxBundlerFiles">> & {
            getFilesUncached?: () => Promise<Record<string, FileData>>;
        };
        scope?: Record<string, unknown>;
        filename?: string;
        toc?: boolean;
        replaceHref?: RehypeLinksOptions["replaceHref"];
        org?: string;
        domain?: string;
        slug?: string;
    } = {},
    domainFallback: string
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

    remoteFiles = (await loader?.getFiles?.()) ?? {};
    files = (await loader?.getMdxBundlerFiles?.()) ?? {};

    // Track usage of custom components (throttled to once per 10 minutes per org-domain)
    if (Object.keys(files).length > 0 && org != null && domain != null) {
        trackCustomComponents(org, domain, files);
    }

    files = mapKeys(files ?? {}, (_file, filename) => {
        if (cwd != null) {
            return path.relative(cwd, filename);
        }
        return filename;
    });

    // Helper to run bundleMDX with given files, returns result and any unresolved file IDs
    const runBundle = async (
        filesToUse: Record<string, FileData>
    ): Promise<{
        bundled: Awaited<ReturnType<typeof bundleMDX>> | null;
        unresolvedFileIds: Array<{ fileId: string; elementName: string | null | undefined }>;
        jsxElements: string[];
        styles: string[];
        lastError: Error | null;
    }> => {
        const unresolvedFileIds: Array<{ fileId: string; elementName: string | null | undefined }> = [];
        const jsxElements: string[] = [];
        const styles: string[] = [];

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
                    rehypeSqueezeParagraphs,
                    rehypeKatex,
                    [
                        rehypeFiles,
                        {
                            files: filesToUse,
                            onUnresolvedFileId: (src: string, elementName: string | null | undefined) => {
                                // Only track unresolved file: references
                                if (!src.startsWith("file:")) {
                                    return;
                                }
                                unresolvedFileIds.push({ fileId: src, elementName });
                            }
                        }
                    ],
                    rehypeMdxClassStyle,
                    rehypeLlmsFilter,
                    rehypeCodeBlock,
                    rehypeSteps,
                    rehypeAccordions,
                    rehypeTable,
                    rehypeTabs,
                    rehypeCards,
                    rehypeParamField,
                    [rehypeSlug, { additionalJsxElements: ["Step", "Accordion", "Tab", "ParamField"] }],
                    [rehypeLinks, { replaceHref }],
                    [
                        rehypeExtractStyles,
                        {
                            collect: (styles_: string[]) => {
                                styles.push(...styles_);
                            }
                        }
                    ],
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
                    [rehypeWebhookPayloadSnippet, { loader }],
                    [rehypeSchema, { loader }],
                    [rehypeRunnableEndpoint, { loader }],
                    [rehypeLang, { loader }],
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
                    rehypeRemoveComments,
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

                o.define = {
                    "process.env": "{}"
                };
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
                    setTimeout(
                        () => reject(new Error(`BundleMDX timed out after ${BUNDLE_MDX_TIMEOUT / 1000} seconds`)),
                        BUNDLE_MDX_TIMEOUT
                    )
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

        return { bundled, unresolvedFileIds, jsxElements, styles, lastError };
    };

    // First pass with cached files
    let result = await runBundle(remoteFiles);

    // If there are unresolved file IDs and we have a fallback, try fetching fresh files from FDR
    if (result.unresolvedFileIds.length > 0 && loader?.getFilesUncached != null) {
        const domainForLogging = domain ?? domainFallback;
        console.warn(
            `[rehype-files] Found ${result.unresolvedFileIds.length} unresolved file IDs for ${domainForLogging}${slug ? "/" + slug : ""}, fetching fresh files from FDR`
        );

        try {
            const freshFiles = await loader.getFilesUncached();
            const mergedFiles = { ...remoteFiles, ...freshFiles };

            // Check if any of the unresolved IDs are now available
            const stillUnresolved = result.unresolvedFileIds.filter(({ fileId }) => {
                const id = fileId.startsWith("file:") ? fileId.slice(5) : fileId;
                return !mergedFiles[id];
            });

            // Only re-bundle if we found new files that could resolve the issues
            if (stillUnresolved.length < result.unresolvedFileIds.length) {
                const resolvedCount = result.unresolvedFileIds.length - stillUnresolved.length;
                console.log(`[rehype-files] Found ${resolvedCount} previously missing files, re-bundling`);

                track("asset_error", {
                    type: "mdx_files_fallback_success",
                    domain: domainForLogging,
                    slug,
                    originalUnresolvedCount: result.unresolvedFileIds.length,
                    resolvedCount,
                    stillUnresolvedCount: stillUnresolved.length
                });

                result = await runBundle(mergedFiles);
                remoteFiles = mergedFiles; // Update for tracking
            } else {
                // Fallback didn't help - files are genuinely missing
                track("asset_error", {
                    type: "mdx_files_fallback_no_help",
                    domain: domainForLogging,
                    slug,
                    unresolvedCount: result.unresolvedFileIds.length,
                    freshFilesCount: Object.keys(freshFiles).length
                });
            }
        } catch (error) {
            console.error(`[rehype-files] Failed to fetch fresh files from FDR:`, error);
            track("asset_error", {
                type: "mdx_files_fallback_error",
                domain: domain ?? domainFallback,
                slug,
                error: String(error)
            });
        }
    }

    const { bundled, unresolvedFileIds, jsxElements, styles, lastError } = result;

    if (!bundled) {
        throw lastError || new Error("BundleMDX failed with all retry attempts");
    }

    if (bundled.errors.length > 0) {
        bundled.errors.forEach((error) => {
            const domainForLogging = domain ?? domainFallback;
            if (!isPreviewDomain(domainForLogging) && !isDevelopment(domainForLogging)) {
                postToSlack(
                    "#docs-notifs",
                    `:rotating_light: Error serializing mdx for ${domainForLogging}${path ? "/" + path : ""} with ${String(error)}`,
                    "mdx-serializer",
                    { message: processedContent, mrkdwn: true }
                );
            }
            console.error(`[serializer:bundle-mdx] ${JSON.stringify(error)}`);
        });
        console.debug("content", processedContent, "code", bundled.code);
    }

    const frontmatter = getMDXExport(bundled)?.frontmatter as Partial<FernDocs.Frontmatter> | undefined;

    // Track unresolved file IDs for debugging missing images (after retry if applicable)
    if (unresolvedFileIds.length > 0) {
        const domainForLogging = domain ?? domainFallback;
        console.warn(
            `[rehype-files] Unresolved file IDs for ${domainForLogging}${slug ? "/" + slug : ""}:`,
            unresolvedFileIds
        );

        track("asset_error", {
            type: "mdx_unresolved_file_ids",
            domain: domainForLogging,
            slug,
            unresolvedCount: unresolvedFileIds.length,
            unresolvedFileIds: unresolvedFileIds.slice(0, 50),
            availableFilesCount: Object.keys(remoteFiles).length
        });
    }

    // TODO: this is doing duplicate work; figure out how to combine it with the compiler above.
    // const { jsxElements } = toTree(content, { sanitize: false });

    return { code: bundled.code, frontmatter, jsxElements, styles, engine: "esbuild" };
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

                track("mdx_serialization_timeout", {
                    domain: options?.domain ?? domain ?? "unknown",
                    slug: options?.slug,
                    filename: options?.filename,
                    contentLength: content.length,
                    timeoutSeconds: serializeTimeout / 1000,
                    hasTwoslash: content.includes("twoslash")
                });

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
                        return undefined;
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
            if (!line) {
                continue;
            }

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
            if (!line) {
                continue;
            }

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
    const hashedKey = hashKey(key);
    const cacheValue = {
        value: value,
        version: TWOSLASH_SEMANTIC_VERSION,
        createdAt: new Date().toISOString()
    };

    kvCache.set("twoslash", hashedKey, cacheValue);
}

async function kvGet(key: string): Promise<Record<string, string> | null> {
    try {
        const hashedKey = hashKey(key);
        const cached = await kvCache.get<Record<string, string>>("twoslash", hashedKey);

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
