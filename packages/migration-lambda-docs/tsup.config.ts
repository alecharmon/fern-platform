import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    target: "node22",
    platform: "node",
    outDir: "dist",
    clean: true,
    bundle: true,
    minify: false,
    sourcemap: false,
    external: ["pg"], // pg has native bindings, can't be bundled
    outExtension: () => ({ js: ".js" }),
    onSuccess: async () => {
        const distDir = path.join(process.cwd(), "dist");

        // Copy migration files from local prisma directory (docs DB has its own migrations)
        const migrationsSource = path.join(process.cwd(), "prisma", "migrations");
        const migrationsDestDir = path.join(distDir, "migrations");

        fs.mkdirSync(migrationsDestDir, { recursive: true });

        // Copy all migration directories
        if (fs.existsSync(migrationsSource)) {
            execSync(`cp -r "${migrationsSource}"/* "${migrationsDestDir}"`);
            // biome-ignore lint/suspicious/noConsole: build script logging is intentional
            console.log("✓ Copied docs database migrations to dist/");
        } else {
            // biome-ignore lint/suspicious/noConsole: build script logging is intentional
            console.warn("⚠ No migrations found at prisma/migrations");
        }
    }
});
