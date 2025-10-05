import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        "plugins/index": "src/plugins/index.ts"
    },
    format: ["esm", "cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ["@fern-api/fdr-sdk", "@fern-api/ui-core-utils", "vfile"],
    noExternal: [
        "collapse-white-space",
        "estree-util-value-to-estree",
        "estree-walker",
        "estree-util-is-identifier-name",
        "github-slugger",
        "hast-util-from-html",
        "hast-util-heading-rank",
        "hast-util-to-estree",
        "hast-util-to-html",
        "hast-util-to-mdast",
        "hast-util-to-string",
        "hastscript",
        "js-yaml",
        "mdast-util-from-markdown",
        "mdast-util-frontmatter",
        "mdast-util-gfm",
        "mdast-util-math",
        "mdast-util-mdx",
        "mdast-util-mdx-jsx",
        "mdast-util-mdxjs-esm",
        "mdast-util-to-hast",
        "mdast-util-to-markdown",
        "micromark-extension-frontmatter",
        "micromark-extension-gfm",
        "micromark-extension-math",
        "micromark-extension-mdxjs",
        "style-to-object",
        "unist-util-visit",
        "unist-util-visit-parents",
        "vfile-message"
    ],
    bundle: true,
    minify: false,
    target: "es2022",
    outDir: "dist/js",
    outExtension({ format }) {
        return {
            js: format === "esm" ? ".mjs" : ".js"
        };
    }
});
