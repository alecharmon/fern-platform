import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    minify: false,
    bundle: true,
    splitting: false,
    dts: false,
    noExternal: ["@fern-docs/search-utils", "@fern-api/docs-utils", "@fern-api/ui-core-utils"],
    external: ["gray-matter"]
});
