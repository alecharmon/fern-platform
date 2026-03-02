import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/fargate-main.ts"],
    format: ["cjs"],
    dts: true,
    outDir: "dist",
    clean: true,
    // Bundle the deps that would otherwise break in CJS (e.g. ESM-only packages),
    // and keep Playwright external (it is installed in the container image).
    noExternal: ["p-limit", "@fern-api/docs-pdf", "axios", "pdf-lib", "zod", "jose"],
    external: ["playwright"],
    platform: "node",
    target: "node22",
    minify: false,
    sourcemap: false
});
