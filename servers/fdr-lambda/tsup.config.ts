import { copyFileSync } from "fs";
import { join } from "path";
import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    dts: true,
    outDir: "dist",
    clean: true,
    // Bundle all dependencies including pg
    noExternal: [/.*/],
    platform: "node",
    target: "node22",
    minify: false,
    sourcemap: false,
    onSuccess: async () => {
        // Copy the RDS CA certificate bundle into dist/ so it's available at runtime
        copyFileSync(join("src", "us-east-1-bundle.pem"), join("dist", "us-east-1-bundle.pem"));
    }
});
