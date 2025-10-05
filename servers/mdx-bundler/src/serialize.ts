import type { RehypeShikiOptions } from "@shikijs/rehype";
import { transformerNotationDiff, transformerNotationFocus, transformerNotationHighlight } from "@shikijs/transformers";
import { transformerTwoslash } from "@shikijs/twoslash";
import { bundleMDX } from "mdx-bundler";
import path from "path";
import ts from "typescript";

import { isNonNullish } from "@fern-api/ui-core-utils";
import { type PluggableList, sanitizeBreaks, sanitizeMdxExpression } from "@fern-docs/mdx";

import { rehypeShikiDisplayNotation } from "./plugins/display-shiki-notation.js";
import { conditionalRehypeShiki } from "./plugins/rehype-shiki-twoslash.js";
import { twoslashRenderer } from "./plugins/twoslashRenderer.js";
import { twoslasher } from "./plugins/twoslasher.js";

export interface SerializeMdxResponse {
    code: string;
    jsxElements: string[];
}

export async function serializeTwoslash(content: string): Promise<SerializeMdxResponse> {
    content = sanitizeBreaks(content);
    content = sanitizeMdxExpression(content)[0];

    process.env.ESBUILD_BINARY_PATH = path.join("/mdx-bundler", "node_modules", ".bin", "esbuild");

    const hasTwoslash = content.includes("twoslash");
    const jsxElements: string[] = [];

    const bundled = await bundleMDX({
        source: content,
        globals: {
            "@mdx-js/react": {
                varName: "MdxJsReact",
                namedExports: ["useMDXComponents"],
                defaultExport: false
            }
        },

        mdxOptions: (o) => {
            o.providerImportSource = "@mdx-js/react";

            const rehypePlugins: PluggableList = [
                [
                    conditionalRehypeShiki,
                    {
                        themes: {
                            light: "min-light",
                            dark: "material-theme-darker"
                        },
                        transformers: [
                            transformerNotationDiff(),
                            transformerNotationFocus(),
                            transformerNotationHighlight(),
                            hasTwoslash
                                ? transformerTwoslash({
                                      onTwoslashError: (error: unknown, code: string, lang: string) => {
                                          console.error("Twoslash error occurred:", error);
                                          console.error("Code:", code);
                                          console.error("Language:", lang);
                                      },
                                      explicitTrigger: true,
                                      throws: false,
                                      twoslasher: twoslasher(),
                                      renderer: twoslashRenderer(),
                                      twoslashOptions: {
                                          customTags: ["allowErrors"],
                                          compilerOptions: {
                                              jsx: ts.JsxEmit.ReactJSX,
                                              module: ts.ModuleKind.ESNext,
                                              moduleResolution: ts.ModuleResolutionKind.Bundler,
                                              esModuleInterop: true,
                                              lib: ["dom", "esnext"],
                                              skipLibCheck: true
                                          },
                                          vfsRoot: "/mdx-bundler"
                                      }
                                  })
                                : null
                        ].filter(isNonNullish)
                    } satisfies RehypeShikiOptions,
                    rehypeShikiDisplayNotation
                ]
            ];

            // o.remarkPlugins = remarkPlugins;
            o.rehypePlugins = rehypePlugins;

            o.development = process.env.NODE_ENV === "development";

            return o;
        },

        esbuildOptions: (o) => {
            o.minify = process.env.NODE_ENV === "production";
            o.sourcemap = false;

            o.logLevel = "error"; // Reduce logging overhead

            o.logLimit = 0; // Disable logging to reduce file operations
            o.metafile = false; // Don't generate metafile (reduces file operations)

            // Add write to memory instead of disk when possible
            o.write = false;

            // Create a restricted define object that excludes process.env
            o.define = {
                "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development")
            };

            // Prevent direct process access
            o.inject = o.inject?.filter((path) => !path.includes("process"));

            return o;
        }
    });

    if (bundled.errors.length > 0) {
        bundled.errors.forEach((error) => {
            console.error(`[serialize-twoslash] ${JSON.stringify(error)}`);
        });
        console.debug("content", content, "code", bundled.code);
    }

    // TODO: this is doing duplicate work; figure out how to combine it with the compiler above.
    // const { jsxElements } = toTree(content, { sanitize: false });

    return { code: bundled.code, jsxElements };
}
