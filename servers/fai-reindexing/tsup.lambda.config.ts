import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/lambda/oom-recovery-handler.ts"],
    format: ["cjs"],
    outDir: "dist-lambda",
    target: "node20",
    platform: "node",
    bundle: true,
    clean: true,
    sourcemap: false,
    minify: false,
    splitting: false,
    treeshake: true,
    external: ["@aws-sdk/*"],
    noExternal: ["@fern-api/fai-sdk"]
});
