/**
 * Patches the stale esbuild files inside @react-email/preview-server's pre-built .next directory.
 *
 * The preview server ships with a Next.js production build that traces esbuild into
 * .next/node_modules/. The traced copy may be a different version than what pnpm installs,
 * causing a "Host version X does not match binary version Y" error at runtime.
 *
 * This script copies the actually-installed esbuild files over the traced copy so they match.
 */

import { cpSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function main(): void {
    // Resolve the installed esbuild
    const installedEsbuildDir = dirname(require.resolve("esbuild/package.json"));

    // Resolve the preview server's .next directory
    const previewServerDir = dirname(require.resolve("@react-email/preview-server/package.json"));
    const nextNodeModules = join(previewServerDir, ".next", "node_modules");

    if (!existsSync(nextNodeModules)) {
        // biome-ignore lint/suspicious/noConsole: script output
        console.log("No .next/node_modules found in preview server — nothing to patch.");
        return;
    }

    // Find the traced esbuild directory (named like esbuild-<hash>)
    const tracedDirs = readdirSync(nextNodeModules).filter((d) => d.startsWith("esbuild"));
    if (tracedDirs.length === 0) {
        // biome-ignore lint/suspicious/noConsole: script output
        console.log("No traced esbuild directory found in .next/node_modules — nothing to patch.");
        return;
    }

    for (const dir of tracedDirs) {
        const tracedDir = join(nextNodeModules, dir);
        // biome-ignore lint/suspicious/noConsole: script output
        console.log(`Patching ${dir} with installed esbuild from ${installedEsbuildDir}`);

        // Copy key files: lib/main.js, package.json, bin/esbuild
        for (const file of ["lib/main.js", "package.json", "bin/esbuild"]) {
            const src = join(installedEsbuildDir, file);
            const dest = join(tracedDir, file);
            if (existsSync(src) && existsSync(dest)) {
                cpSync(src, dest);
            }
        }
    }

    // biome-ignore lint/suspicious/noConsole: script output
    console.log("Successfully patched preview server esbuild.");
}

main();
