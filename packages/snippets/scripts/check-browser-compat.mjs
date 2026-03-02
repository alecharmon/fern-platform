// biome-ignore-all lint/suspicious/noConsole: CLI script requires console output
/**
 * Browser Compatibility Check for @fern-api/snippets
 *
 * This script uses esbuild to bundle the package with `platform: "browser"` and a
 * custom plugin that rejects any imports of Node.js built-in modules.
 *
 * If any dependency (direct or transitive) pulls in a Node.js-only API, the build
 * will fail with an explicit error listing the offending import and its importer.
 *
 * This catches the class of regression described in FER-7689, where a transitive
 * dependency introduced a `require("util")` call that broke the browser bundle.
 */

import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");

/**
 * esbuild plugin that errors on any Node.js built-in import.
 */
const rejectNodeBuiltinsPlugin = {
    name: "reject-node-builtins",
    setup(build) {
        const filter = new RegExp(
            `^(node:)?(${builtinModules.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(/.*)?$`
        );

        build.onResolve({ filter }, (args) => {
            if (!args.importer) {
                return undefined;
            }

            return {
                errors: [
                    {
                        text: `Node.js built-in module "${args.path}" is not available in the browser. Imported by "${args.importer}".`
                    }
                ]
            };
        });
    }
};

async function main() {
    console.log("Checking browser compatibility for @fern-api/snippets...\n");

    try {
        const result = await esbuild.build({
            entryPoints: [path.join(PACKAGE_ROOT, "src", "index.ts")],
            bundle: true,
            platform: "browser",
            format: "esm",
            write: false,
            logLevel: "warning",
            plugins: [rejectNodeBuiltinsPlugin],
            absWorkingDir: PACKAGE_ROOT,
            loader: {
                ".json": "json"
            },
            treeShaking: true
        });

        if (result.errors.length > 0) {
            console.error("\nBrowser compatibility check FAILED:\n");
            for (const error of result.errors) {
                console.error(`  ERROR: ${error.text}`);
            }
            process.exit(1);
        }

        if (result.warnings.length > 0) {
            console.warn("esbuild warnings:\n");
            for (const warning of result.warnings) {
                console.warn(`  - ${warning.text}`);
            }
        }

        console.log("Browser compatibility check PASSED.");
        console.log("No Node.js built-in modules detected in the browser bundle.\n");
    } catch (error) {
        console.error("\nBrowser compatibility check FAILED.\n");
        if (error.errors) {
            for (const e of error.errors) {
                console.error(`  ERROR: ${e.text}`);
            }
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

main();
