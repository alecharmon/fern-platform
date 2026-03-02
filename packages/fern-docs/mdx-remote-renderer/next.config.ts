import type { NextConfig } from "next";
import path from "path";
import webpack from "webpack";

const NEXT_IMAGE_HOSTS = [
    "fdr-prod-docs-files.s3.us-east-1.amazonaws.com",
    "fdr-prod-docs-files-public.s3.amazonaws.com",
    "fdr-dev2-docs-files.s3.us-east-1.amazonaws.com",
    "fdr-dev2-docs-files-public.s3.amazonaws.com",
    "files.buildwithfern.com",
    "files-dev2.buildwithfern.com",
    "icons.ferndocs.com"
];

const nextConfig: NextConfig = {
    experimental: {
        useCache: true,
        optimizePackageImports: [
            "@fern-api/fdr-sdk",
            "@fern-docs/bundle",
            "@fern-docs/mdx",
            "@fern-docs/components",
            "@fern-docs/search-keyword",
            "@fern-docs/search-ask-fern",
            "@fern-docs/search-ui",
            "@fern-api/docs-server",
            "@fern-api/docs-loader",
            "es-toolkit",
            "ts-essentials"
        ]
    },
    turbopack: {
        resolveAlias: {
            "@bundle": path.resolve(__dirname, "../bundle/src"),
            "node:console": "console",
            "node:process": "process",
            "node:path": "path",
            "node:fs": "fs",
            "node:url": "url",
            "node:util": "util",
            "node:stream": "stream",
            "node:buffer": "buffer",
            "node:events": "events",
            "node:assert": "assert",
            "node:os": "os",
            "node:crypto": "crypto",
            "node:net": "net",
            "node:http": "http",
            "node:https": "https",
            "node:zlib": "zlib"
        }
    },
    transpilePackages: [
        "es-toolkit",
        "@fern-api/fdr-sdk",
        "@fern-api/ui-core-utils",
        "@fern-api/docs-server",
        "@fern-api/docs-loader",
        "@fern-docs/bundle",
        "@fern-docs/components",
        "@fern-docs/mdx",
        "@fern-docs/search-ui",
        "@fern-api/docs-utils",
        "@fern-platform/fdr-utils",
        "@fern-ui/loadable",
        "@fern-ui/react-commons"
    ],
    images: {
        remotePatterns: NEXT_IMAGE_HOSTS.map((host) => ({
            protocol: "https",
            hostname: host
        }))
    },
    serverExternalPackages: ["esbuild", "@typescript/vfs"],
    webpack: (config, { isServer }) => {
        // Handle node: protocol imports by aliasing them to their non-prefixed versions
        config.resolve.alias = {
            ...config.resolve.alias,
            "@bundle": path.resolve(__dirname, "../bundle/src"),
            "node:console": "console",
            "node:process": "process",
            "node:path": "path",
            "node:fs": "fs",
            "node:url": "url",
            "node:util": "util",
            "node:stream": "stream",
            "node:buffer": "buffer",
            "node:events": "events",
            "node:assert": "assert",
            "node:os": "os",
            "node:crypto": "crypto",
            "node:net": "net",
            "node:http": "http",
            "node:https": "https",
            "node:zlib": "zlib"
        };

        if (isServer) {
            config.externals = config.externals || [];
            config.externals.push("esbuild");
            config.externals.push("@typescript/vfs");
        }

        config.resolve.fallback = {
            ...config.resolve.fallback,
            crypto: false
        };

        // Strip "server-only" imports from bundle and commons packages
        // This allows us to use server code in Pages Router API routes
        config.module.rules.push({
            test: /\.(ts|tsx|js)$/,
            include: [path.resolve(__dirname, "../bundle/src"), path.resolve(__dirname, "../../commons")],
            use: [
                {
                    loader: "string-replace-loader",
                    options: {
                        search: 'import "server-only";',
                        replace: "// server-only import removed by webpack",
                        flags: "g"
                    }
                }
            ]
        });

        // Strip "use client" directives from bundle and commons packages
        // This allows us to use client-marked code in Pages Router API routes
        config.module.rules.push({
            test: /\.(ts|tsx|js)$/,
            include: [path.resolve(__dirname, "../bundle/src"), path.resolve(__dirname, "../../commons")],
            use: [
                {
                    loader: "string-replace-loader",
                    options: {
                        search: '"use client";',
                        replace: "// use client directive removed by webpack",
                        flags: "g"
                    }
                },
                {
                    loader: "string-replace-loader",
                    options: {
                        search: "'use client';",
                        replace: "// use client directive removed by webpack",
                        flags: "g"
                    }
                }
            ]
        });

        // Handle shader files (.glsl, .frag, etc.) used by waveform components
        config.module.rules.push({
            test: /\.(glsl|vs|fs|vert|frag)$/,
            exclude: /node_modules/,
            use: [
                "raw-loader",
                {
                    loader: "glslify-loader",
                    options: {
                        transform: ["glslify-import"]
                    }
                }
            ]
        });

        // Rewrite @/ imports from bundle to point to bundle's src directory
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(/^@\//, (resource) => {
                // Check if the import is coming from within the bundle package
                if (resource.context.includes("/bundle/src")) {
                    // Rewrite @/ to point to bundle's src directory
                    const bundleSrcPath = path.resolve(__dirname, "../bundle/src");
                    const newRequest = resource.request.replace(/^@\//, bundleSrcPath + "/");

                    // Debug logging
                    if (process.env.DEBUG_WEBPACK) {
                        console.log("[NormalModuleReplacement]");
                        console.log("  context:", resource.context);
                        console.log("  original request:", resource.request);
                        console.log("  new request:", newRequest);
                    }

                    resource.request = newRequest;
                }
            })
        );

        return config;
    }
};

export default nextConfig;
