import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts"
    },
    format: ["esm", "cjs"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: true,
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
