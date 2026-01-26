import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/run.ts"],
    format: ["cjs"],
    dts: true,
    outDir: "dist",
    clean: true,
    noExternal: [/.*/],
    platform: "node",
    target: "node22",
    minify: false,
    sourcemap: false
});
