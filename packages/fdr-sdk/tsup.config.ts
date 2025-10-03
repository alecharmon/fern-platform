import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        "navigation/index": "src/navigation/index.ts",
        "api-definition/index": "src/api-definition/index.ts",
        "docs/index": "src/docs/index.ts",
        "client/FdrClient": "src/client/FdrClient.ts",
        "client/types": "src/client/types.ts",
        "utils/traversers/index": "src/utils/traversers/index.ts"
    },
    format: ["esm", "cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: [],
    noExternal: ["@fern-api/ui-core-utils"],
    bundle: true,
    minify: false,
    target: "es2022",
    outDir: "dist/js",
    tsconfig: "tsconfig.build.json",
    outExtension({ format }) {
        return {
            js: format === "esm" ? ".mjs" : ".js"
        };
    }
});
