import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts", // Orchestrator entrypoint
        worker: "src/worker.ts" // Delegated worker entrypoint
    },
    format: ["cjs"], // Use CommonJS instead of ESM to support dynamic requires
    target: "node22",
    outDir: "dist-bundle",
    clean: true,
    sourcemap: true,
    minify: false,
    bundle: true,
    splitting: false,
    dts: false,
    // Only externalize native modules that can't be bundled
    external: ["@aws-sdk/client-ecs", "@aws-sdk/client-sqs", "@vercel/edge-config"],
    // Don't mark anything as external automatically
    noExternal: ["winston", "winston-transport", "@fern-api/*", "@fern-docs/*", /.*/],
    // Enable shims for Node.js built-ins
    shims: true,
    // Ensure platform is set correctly
    platform: "node"
});
