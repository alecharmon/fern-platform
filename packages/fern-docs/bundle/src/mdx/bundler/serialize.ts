import "server-only";

import { track } from "@fern-api/docs-server";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
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
    rehypeRemoveMdxComments,
    rehypeSlug,
    rehypeSqueezeParagraphs,
    rehypeToc,
    remarkInjectEsm,
    remarkSanitizeAcorn
} from "@fern-docs/mdx/plugins";
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
import { rehypeAccordions } from "../plugins/rehype-accordions";
import { rehypeApiLinks, sanitizeApiLinks } from "../plugins/rehype-api-links";
import { rehypeButtons } from "../plugins/rehype-buttons";
import { rehypeCards } from "../plugins/rehype-cards";
import { rehypeCollectJsx } from "../plugins/rehype-collect-jsx";
import { rehypeEndpointExampleSnippets } from "../plugins/rehype-endpoint-example-snippets";
import { rehypeEndpointSchemaSnippets } from "../plugins/rehype-endpoint-schema-snippet";
import { rehypeExtractAsides } from "../plugins/rehype-extract-asides";
import { rehypeExtractStyles } from "../plugins/rehype-extract-styles";
import { rehypeFiles } from "../plugins/rehype-files";
import { rehypeInlineFaIcons } from "../plugins/rehype-inline-fa-icons";
import { rehypeLang } from "../plugins/rehype-lang";
import { type RehypeLinksOptions, rehypeLinks } from "../plugins/rehype-links";
import { rehypeLlmsFilter } from "../plugins/rehype-llms-filter";
import { rehypeMigrateJsx } from "../plugins/rehype-migrate-jsx";
import { rehypeAccordionNestedHeaders, rehypeTabNestedHeaders } from "../plugins/rehype-nested-headers";
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

const SERIALIZATION_TIMEOUT = 50_000;
const BUNDLE_MDX_TIMEOUT = 50_000;

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
    content = sanitizeApiLinks(content);

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
                    rehypeInlineFaIcons,
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
                    [rehypeApiLinks, { loader }],
                    [
                        rehypeExtractStyles,
                        {
                            collect: (styles_: string[]) => {
                                styles.push(...styles_);
                            }
                        }
                    ],
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
                    rehypeRemoveMdxComments,
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

        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`BundleMDX timed out after ${BUNDLE_MDX_TIMEOUT / 1000} seconds`)),
                    BUNDLE_MDX_TIMEOUT
                )
            );

            bundled = await Promise.race([bundleMDX(createBundleConfig(content)), timeoutPromise]);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`BundleMDX failed:`, lastError.message);
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
                    { message: content, mrkdwn: true }
                );
            }
            console.error(`[serializer:bundle-mdx] ${JSON.stringify(error)}`);
        });
        console.debug("content", content, "code", bundled.code);
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

        const timeoutId = setTimeout(() => {
            if (!signal.aborted) {
                abortController.abort();
                console.error(`Serialize MDX timed out after ${SERIALIZATION_TIMEOUT / 1000} seconds`);

                track("mdx_serialization_timeout", {
                    domain: options?.domain ?? domain ?? "unknown",
                    slug: options?.slug,
                    filename: options?.filename,
                    contentLength: content.length,
                    timeoutSeconds: SERIALIZATION_TIMEOUT / 1000
                });

                reject(new Error("Serialize MDX timed out"));
            }
        }, SERIALIZATION_TIMEOUT);

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
