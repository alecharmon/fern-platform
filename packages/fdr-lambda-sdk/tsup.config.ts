import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts"
    },
    format: ["esm", "cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: [],
    bundle: true,
    minify: false,
    target: "es2022",
    outDir: "dist/js",
    tsconfig: "tsconfig.json",
    outExtension({ format }) {
        return {
            js: format === "esm" ? ".mjs" : ".js"
        };
    }
});
