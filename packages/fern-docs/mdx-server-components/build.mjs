/**
 * Pre-compiles the MDX component factory into a standalone CJS bundle.
 *
 * This script produces dist/index.js — a plain JavaScript file that:
 * - Has no "use client" directives (stripped)
 * - Has no next/dynamic calls (replaced with a synchronous shim)
 * - Resolves all @/ path aliases (mapped to bundle/src/)
 * - Externalizes React, react-dom, and react/jsx-runtime (singleton at runtime)
 * - Externalizes all node_modules (resolved at runtime via require())
 *
 * The output is consumed by the bundle's Pages Router API route via
 * serverExternalPackages, which tells Turbopack to emit require() instead
 * of analyzing the dependency tree.
 */
import { build } from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundleSrc = path.resolve(__dirname, "../bundle/src");

/**
 * esbuild plugin that resolves workspace packages to their TypeScript source
 * when compiled dist/ files don't exist yet (e.g. in CI where packages may
 * not have been compiled before this build runs).
 *
 * For example, @fern-api/fdr-sdk/api-definition exports "./dist/js/api-definition/index.mjs"
 * but if that file doesn't exist, we resolve to "src/api-definition/index.ts" instead.
 * esbuild handles TypeScript natively, so this works without prior compilation.
 *
 * This handles both root imports (@fern-api/fdr-sdk) and subpath imports
 * (@fern-api/fdr-sdk/api-definition), and resolves packages from any location
 * in the monorepo (not just the bundle's node_modules).
 */
const resolveWorkspaceSourcePlugin = {
    name: "resolve-workspace-source",
    setup(bld) {
        const monorepoRoot = path.resolve(__dirname, "../../..");

        // Build a static map of workspace package name → directory at startup
        // by scanning all package.json files in the packages/ directory
        const workspacePackages = new Map();
        function scanWorkspacePackages(dir) {
            const pkgJsonPath = path.join(dir, "package.json");
            if (fs.existsSync(pkgJsonPath)) {
                try {
                    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
                    if (pkgJson.name) {
                        workspacePackages.set(pkgJson.name, dir);
                    }
                } catch {
                    // Skip invalid package.json
                }
            }
            // Recurse into subdirectories (but not node_modules or dist)
            try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    if (
                        entry.isDirectory() &&
                        entry.name !== "node_modules" &&
                        entry.name !== "dist" &&
                        entry.name !== ".next"
                    ) {
                        scanWorkspacePackages(path.join(dir, entry.name));
                    }
                }
            } catch {
                // Skip unreadable directories
            }
        }
        scanWorkspacePackages(path.join(monorepoRoot, "packages"));

        // Match any @fern-api/* or @fern-docs/* or @fern-ui/* or @fern-platform/* import
        bld.onResolve({ filter: /^@fern-(api|docs|ui|platform)\// }, (args) => {
            const parts = args.path.split("/");
            const packageName = parts.slice(0, 2).join("/");
            const subpath = parts.slice(2).join("/"); // Empty string for root imports

            const pkgDir = workspacePackages.get(packageName);
            if (!pkgDir) {
                return undefined; // Not a known workspace package
            }

            // Read the package.json exports to find the dist and source paths
            let pkgJson;
            try {
                pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
            } catch {
                return undefined; // Can't read package.json
            }

            const exportKey = subpath ? `./${subpath}` : ".";
            const exportEntry = pkgJson.exports?.[exportKey];

            // Handle both object exports ({ import, require, default }) and string exports ("./src/Foo.tsx")
            const targetFile =
                typeof exportEntry === "string"
                    ? exportEntry
                    : exportEntry?.import || exportEntry?.require || exportEntry?.default;

            // If the export target is a source file (.ts/.tsx) that exists, resolve directly
            if (targetFile && /\.(tsx?|jsx?)$/.test(targetFile)) {
                const sourceCandidate = path.resolve(pkgDir, targetFile);
                if (fs.existsSync(sourceCandidate)) {
                    return { path: sourceCandidate };
                }
            }

            // If the compiled dist file exists, let esbuild's native resolver handle it
            if (targetFile && fs.existsSync(path.resolve(pkgDir, targetFile))) {
                return undefined;
            }

            // Dist file doesn't exist (e.g. package not yet compiled in CI).
            // Resolve to TypeScript source instead — esbuild handles TS natively.

            // Strategy 1: Derive source path from the dist export path.
            // e.g. "./dist/js/utils/traversers/index.mjs" → "src/utils/traversers/index.ts"
            if (targetFile) {
                const distMatch = targetFile.match(/\.\/dist\/(?:js\/|types\/)?(.+?)(?:\.mjs|\.js|\.d\.ts)$/);
                if (distMatch) {
                    const srcRelative = distMatch[1];
                    for (const ext of [".ts", ".tsx"]) {
                        const candidate = path.resolve(pkgDir, "src", srcRelative + ext);
                        if (fs.existsSync(candidate)) {
                            return { path: candidate };
                        }
                    }
                }
            }

            // Strategy 2: Conventional source paths based on the export subpath
            const srcSubpath = subpath || "";
            const candidates = srcSubpath
                ? [
                      path.resolve(pkgDir, "src", srcSubpath, "index.ts"),
                      path.resolve(pkgDir, "src", srcSubpath, "index.tsx"),
                      path.resolve(pkgDir, "src", srcSubpath + ".ts"),
                      path.resolve(pkgDir, "src", srcSubpath + ".tsx")
                  ]
                : [path.resolve(pkgDir, "src", "index.ts"), path.resolve(pkgDir, "src", "index.tsx")];

            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                    return { path: candidate };
                }
            }

            // Could not resolve source — log warning but DON'T return undefined,
            // because esbuild's native resolver will also fail (dist doesn't exist).
            // Mark as external so the build doesn't break; it will be resolved at runtime.
            console.warn(`[resolve-workspace-source] Could not find source for ${args.path} in ${pkgDir}`);
            return { path: args.path, external: true };
        });
    }
};

/**
 * esbuild plugin that:
 * 1. Strips "use client"; directives
 * 2. Replaces `import dynamic from "next/dynamic"` with a server-safe shim
 *    that synchronously resolves the dynamic import for renderToString
 */
const stripDirectivesPlugin = {
    name: "strip-directives",
    setup(build) {
        // Intercept all .tsx/.ts/.js files in the bundle source
        build.onLoad({ filter: /\.(tsx?|jsx?)$/ }, async (args) => {
            let contents = await fs.promises.readFile(args.path, "utf8");

            // Strip "use client" directives
            contents = contents.replace(/^"use client";?\s*/gm, "// [stripped] use client\n");
            contents = contents.replace(/^'use client';?\s*/gm, "// [stripped] use client\n");

            // Strip import "server-only" (not needed in this context)
            contents = contents.replace(/^import\s+["']server-only["'];?\s*/gm, "// [stripped] server-only\n");

            // Determine loader from file extension
            const ext = path.extname(args.path);
            let loader = "tsx";
            if (ext === ".ts") {
                loader = "ts";
            } else if (ext === ".js") {
                loader = "js";
            } else if (ext === ".jsx") {
                loader = "jsx";
            }

            return { contents, loader };
        });
    }
};

/**
 * esbuild plugin that replaces next/dynamic with a server-safe shim.
 *
 * In the component tree, next/dynamic is used like:
 *   const Foo = dynamic(() => import("./Foo").then(m => m.default), { ssr: false })
 *
 * For server-side renderToString:
 * - ssr: false → render nothing (return null component)
 * - ssr: true (default) → eagerly resolve the import
 *
 * We replace the next/dynamic module with a shim that handles both cases.
 */
const nextDynamicShimPlugin = {
    name: "next-dynamic-shim",
    setup(build) {
        build.onResolve({ filter: /^next\/dynamic$/ }, (args) => {
            return { path: "next-dynamic-shim", namespace: "shim", pluginData: { resolveDir: args.resolveDir } };
        });

        build.onLoad({ filter: /^next-dynamic-shim$/, namespace: "shim" }, (args) => {
            return {
                resolveDir: args.pluginData?.resolveDir || __dirname,
                contents: `
                    // Server-safe shim for next/dynamic
                    // For SSR via renderToString, we need synchronous component resolution.
                    // Components with ssr:false render null on the server (same as real next/dynamic).
                    // Components with ssr:true (default) get a wrapper that renders a placeholder
                    // since we can't synchronously resolve dynamic imports.
                    const React = require("react");

                    function dynamic(loader, options) {
                        const opts = options || {};

                        // ssr: false means don't render on server — return null component
                        if (opts.ssr === false) {
                            const NullComponent = function() { return null; };
                            NullComponent.displayName = "DynamicSSRDisabled";
                            return NullComponent;
                        }

                        // ssr: true (default) — create a component that tries to resolve
                        // For renderToString, we need the component to be available synchronously.
                        // We'll use the loading component as fallback if the dynamic import can't resolve sync.
                        let resolved = null;
                        let resolveError = null;

                        // Try to eagerly kick off the import
                        const promise = typeof loader === "function" ? loader() : loader;
                        if (promise && typeof promise.then === "function") {
                            promise.then(
                                (mod) => { resolved = mod.default || mod; },
                                (err) => { resolveError = err; }
                            );
                        }

                        const DynamicComponent = function(props) {
                            if (resolved) {
                                return React.createElement(resolved, props);
                            }
                            if (opts.loading) {
                                return React.createElement(opts.loading, {});
                            }
                            return null;
                        };
                        DynamicComponent.displayName = "DynamicServerShim";
                        return DynamicComponent;
                    }

                    module.exports = dynamic;
                    module.exports.default = dynamic;
                `,
                loader: "js"
            };
        });
    }
};

/**
 * esbuild plugin that handles non-JS assets (SCSS, GLSL shaders, etc.)
 * by replacing them with empty modules or text content.
 * These are irrelevant for server-side renderToString.
 */
const assetPlugin = {
    name: "asset-handler",
    setup(build) {
        // SCSS/CSS files — not needed for SSR, emit empty module
        build.onResolve({ filter: /\.s?css$/ }, (args) => {
            return { path: args.path, namespace: "empty-asset" };
        });
        build.onLoad({ filter: /.*/, namespace: "empty-asset" }, () => {
            return { contents: "", loader: "js" };
        });

        // GLSL shader files (.vert, .frag, .glsl, .vs, .fs) — export as empty string
        build.onLoad({ filter: /\.(vert|frag|glsl|vs|fs)$/ }, () => {
            return { contents: "module.exports = '';", loader: "js" };
        });
    }
};

// Ensure dist directory exists
const distDir = path.resolve(__dirname, "dist");
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

try {
    const result = await build({
        entryPoints: [path.resolve(__dirname, "index.tsx")],
        bundle: true,
        outfile: path.resolve(distDir, "index.js"),
        platform: "node",
        format: "cjs",
        target: "node18",

        // Resolve @/ path aliases (tsconfig paths in the bundle)
        alias: {
            "@/*": bundleSrc + "/*"
        },

        // Plugins: order matters — resolve workspace source first (for CI), then shims, then strip directives, then handle assets
        plugins: [resolveWorkspaceSourcePlugin, nextDynamicShimPlugin, assetPlugin, stripDirectivesPlugin],

        // Externalize ONLY React ecosystem (must be singletons with the host app)
        // and Next.js internals. Everything else gets bundled into the output
        // so Turbopack has nothing to resolve.
        external: [
            "react",
            "react-dom",
            "react-dom/*",
            "react/*",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            // Next.js internals that must come from the host app
            "next/image",
            "next/link",
            "next/navigation",
            "next/headers",
            "next/router",
            // server-only marker (stripped by our plugin but may appear in deps)
            "server-only"
        ],

        // Don't minify — keep readable for debugging
        minify: false,

        // Source maps for debugging
        sourcemap: true,

        // Handle JSX
        jsx: "automatic",

        // Suppress warnings about require() in CJS output
        logLevel: "warning"
    });

    if (result.errors.length > 0) {
        console.error("Build failed:", result.errors);
        process.exit(1);
    }

    console.log("✅ @fern-docs/mdx-server-components built successfully → dist/index.js");
    if (result.warnings.length > 0) {
        console.log(`   ${result.warnings.length} warning(s)`);
    }
} catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
}
