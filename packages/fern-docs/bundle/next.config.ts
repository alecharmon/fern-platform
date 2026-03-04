import path from "node:path";
import process from "node:process";

import NextBundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import webpack from "webpack";

const cdnUri = process.env.NEXT_PUBLIC_CDN_URI != null ? new URL("/", process.env.NEXT_PUBLIC_CDN_URI) : undefined;
const isTrailingSlashEnabled = process.env.NEXT_PUBLIC_TRAILING_SLASH === "1";
const isAssetPrefixDisabled = process.env.NEXT_PUBLIC_ASSET_PREFIX_DISABLED === "1";
const isSelfHosted = process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1";
const isLocal = process.env.NEXT_PUBLIC_IS_LOCAL === "1";
const isStandalone = process.env.NEXT_PUBLIC_IS_LOCAL === "1" || process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1";
// Disable minification for staging/dev Vercel projects (e.g. prod.ferndocs.com, dev.ferndocs.com)
// Set NEXT_DISABLE_MINIFICATION=1 in the Vercel project's environment variables to get readable stack traces
const isMinificationDisabled = process.env.NEXT_DISABLE_MINIFICATION === "1";
// Disable cache for local development, or when explicitly requested via NEXT_DISABLE_CACHE=1
// Self-hosted production should have caching enabled for performance
const isCacheDisabled = process.env.NEXT_PUBLIC_IS_LOCAL === "1" || process.env.NEXT_DISABLE_CACHE === "1";

// For self-hosted deployments, support serving the app from a basePath
const nextBasePath = isSelfHosted && process.env.NEXT_PUBLIC_BASE_PATH ? process.env.NEXT_PUBLIC_BASE_PATH : undefined;

// Log basePath configuration at startup
if (isSelfHosted) {
    console.log("[next.config] Self-hosted configuration:", {
        NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
        basePath: nextBasePath,
        assetPrefixDisabled: isAssetPrefixDisabled,
        cdnUri: cdnUri?.href
    });
}

// TODO: move this to a shared location (this is copied in FernImage.tsx)
const NEXT_IMAGE_HOSTS = [
    "fdr-prod-docs-files.s3.us-east-1.amazonaws.com",
    "fdr-prod-docs-files-public.s3.amazonaws.com",
    "fdr-dev2-docs-files.s3.us-east-1.amazonaws.com",
    "fdr-dev2-docs-files-public.s3.amazonaws.com",
    "files.buildwithfern.com",
    "files-dev2.buildwithfern.com"
];

const nextConfig: NextConfig = {
    reactStrictMode: true,
    crossOrigin: "anonymous",
    basePath: nextBasePath,
    trailingSlash: isTrailingSlashEnabled,
    transpilePackages: [
        "es-toolkit",
        "three",

        /**
         * Monorepo packages that are not transpiled by default.
         *
         * pnpm list --filter=@fern-docs/bundle --only-projects --prod --recursive --depth=Infinity --json | jq -r '[.. | objects | select(.version | .!=null) | select(.version | startswith("link:")) | .from] | unique'
         */
        "@fern-api/fdr-sdk",
        "@fern-api/ui-core-utils",
        "@fern-api/docs-loader",
        "@fern-api/docs-auth",
        "@fern-docs/components",
        "@fern-docs/edge-config",
        "@fern-docs/mdx",
        "@fern-docs/search-keyword",
        "@fern-docs/search-ask-fern",
        "@fern-docs/search-ui",
        "@fern-api/docs-utils",
        "@fern-platform/fdr-utils",
        "@fern-ui/loadable",
        "@fern-ui/react-commons"
    ],
    experimental: {
        appNavFailHandling: true,
        scrollRestoration: true,
        optimisticClientCache: true,
        optimizeCss: true,
        optimizePackageImports: [
            "@fern-api/fdr-sdk",
            "@fern-docs/mdx",
            "@fern-docs/components",
            "@fern-docs/search-keyword",
            "@fern-docs/search-ask-fern",
            "@fern-docs/search-ui",
            "@fern-api/docs-server",
            "@fern-api/docs-loader",
            "es-toolkit",
            "ts-essentials",
            "lucide-react",

            /**
             * optimize imports for all rehype and unist related packages.
             */
            "@mdx-js/esbuild",
            "@mdx-js/mdx",
            "@mdx-js/react",
            "estree-util-is-identifier-name",
            "estree-util-value-to-estree",
            "estree-walker",
            "rehype-katex",
            "remark-frontmatter",
            "remark-gemoji",
            "remark-gfm",
            "remark-math",
            "remark-mdx-frontmatter",
            "remark-smartypants",
            "remark-squeeze-paragraphs"
        ],
        authInterrupts: true,
        taint: true,
        useCache: true,
        serverComponentsHmrCache: true,
        serverActions: {
            allowedOrigins: ["*"]
        }
    },

    outputFileTracingExcludes: {
        "**": [".next/cache/**/*", ".next/trace.json", "**/*.map", "node_modules/**/*.d.ts"]
    },

    outputFileTracingRoot: isStandalone ? path.join(__dirname, "../../..") : undefined,

    // speed up build
    typescript: {
        // TODO: Re-enable once search-ui TypeScript errors are fixed
        // Currently ignoring because search-ui has ~19 TypeScript errors that we don't want to block builds
        // The bundle package itself should have no TypeScript errors (verified via pnpm tsc --noEmit in bundle dir)
        ignoreBuildErrors: true
    },
    skipProxyUrlNormalize: true,

    /**
     * This is required for posthog. See https://posthog.com/docs/advanced/proxy/nextjs-middleware
     */
    skipTrailingSlashRedirect: true,

    /**
     * Customers who opt-in for subpath routing must use rewrite rules from their hosting provider. Because of the
     * multi-tenant nature of this app, we cannot set a global basepath in the next.config.js. As a result, the `_next`
     * subpath does not exist in their hosting provider. Potentially, even, their root path is also a next.js app.
     * To avoid conflicting with the customer's app, or introduce complex rewrite rules for the customer, we must edit
     * the `assetPrefix` to point to an external URL that hosts all static assets (which we call the CDN_URI).
     * On prod, the CDN_URI is currently https://legacy.ferndocs.com.
     *
     * Note that local development should not set the CDN_URI to ensure that the assets are served from the local server.
     * For self-hosted deployments with a basePath, the assetPrefix should match the basePath.
     */
    assetPrefix: isAssetPrefixDisabled ? undefined : cdnUri != null ? cdnUri.href : nextBasePath,
    compiler: {
        // Note: i think this removes console logs in server-side code?
        // removeConsole:
        //   process.env.VERCEL_ENV === "production"
        //     ? { exclude: ["error", "log"] }
        //     : false,
        styledJsx: true
    },
    logging: {
        fetches: {
            fullUrl: true
            //   hmrRefreshes: true,
        },
        incomingRequests: true
    },
    headers: async () => {
        const AccessControlHeaders = [
            {
                key: "Access-Control-Allow-Origin",
                value: "*"
            },
            {
                key: "Access-Control-Allow-Methods",
                value: "GET, POST, PUT, DELETE, OPTIONS"
            },
            {
                key: "Access-Control-Allow-Headers",
                value: "Content-Type, Authorization"
            },
            {
                key: "Access-Control-Allow-Credentials",
                value: "true"
            }
        ];

        const searchV2Headers = [
            {
                key: "Access-Control-Allow-Origin",
                value: "*"
            },
            {
                key: "Access-Control-Allow-Methods",
                value: "GET, POST, OPTIONS"
            },
            {
                key: "Access-Control-Allow-Headers",
                value: "*"
            }
        ];

        const securityHeaders = [
            {
                key: "X-Content-Type-Options",
                value: "nosniff"
            },
            {
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin"
            },
            {
                key: "Strict-Transport-Security",
                value: "max-age=63072000; includeSubDomains; preload"
            },
            {
                key: "Permissions-Policy",
                value: "camera=(), geolocation=()"
            },
            {
                key: "Content-Security-Policy",
                value: (() => {
                    const httpScheme = isLocal ? "https: http:" : "https:";
                    const cdnOrigin = cdnUri?.origin ?? "";
                    return [
                        "default-src 'self'",
                        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${cdnOrigin} ${httpScheme} blob:`,
                        `style-src 'self' 'unsafe-inline' ${cdnOrigin} ${httpScheme}`,
                        `img-src 'self' ${cdnOrigin} ${httpScheme} data: blob:`,
                        `font-src 'self' ${cdnOrigin} ${httpScheme} data:`,
                        `connect-src 'self' ${cdnOrigin} ${httpScheme} wss: ws: data: blob:`,
                        `media-src 'self' ${cdnOrigin} ${httpScheme} data: blob:`,
                        `object-src 'self' ${cdnOrigin} ${httpScheme} data: blob:`,
                        `frame-src 'self' ${cdnOrigin} ${httpScheme} data: blob:`,
                        "base-uri 'self'",
                        `form-action 'self' ${cdnOrigin} ${httpScheme}`
                    ].join("; ");
                })()
            }
        ];

        const disableCaching = {
            source: "/:path*",
            headers: [
                {
                    key: "Cache-Control",
                    value: "no-store, no-cache, must-revalidate, proxy-revalidate"
                },
                { key: "Pragma", value: "no-cache" },
                { key: "Expires", value: "0" }
            ]
        };

        return [
            {
                source: "/:path*",
                headers: securityHeaders
            },
            {
                source: "/api/fern-docs/auth/:path*",
                headers: AccessControlHeaders
            },
            {
                source: "/:prefix*/api/fern-docs/auth/:path*",
                headers: AccessControlHeaders
            },
            {
                source: "/api/fern-docs/search/v2/:path*",
                headers: searchV2Headers
            },
            {
                source: "/:prefix*/api/fern-docs/search/v2/:path*",
                headers: searchV2Headers
            },
            // Disable caching for local development (always fresh content) or when explicitly requested
            // For self-hosted production, caching is enabled by default for performance
            ...(isCacheDisabled ? [disableCaching] : [])
        ];
    },
    images: {
        remotePatterns: NEXT_IMAGE_HOSTS.map((host) => ({
            protocol: "https",
            hostname: host
        })),
        path: cdnUri != null ? `${cdnUri.href}_next/image` : nextBasePath ? `${nextBasePath}/_next/image` : undefined
    },
    turbopack: {
        rules: {
            "*.glsl": {
                loaders: ["raw-loader"],
                as: "*.js"
            },
            "*.vert": {
                loaders: ["raw-loader"],
                as: "*.js"
            },
            "*.frag": {
                loaders: ["raw-loader"],
                as: "*.js"
            },
            "*.vs": {
                loaders: ["raw-loader"],
                as: "*.js"
            },
            "*.fs": {
                loaders: ["raw-loader"],
                as: "*.js"
            }
        },
        resolveAlias: {}
    },
    serverExternalPackages: ["esbuild", "@typescript/vfs"],
    webpack: (config, { isServer }) => {
        if (isMinificationDisabled) {
            config.optimization = {
                ...config.optimization,
                minimize: false
            };
        }

        // Handle node: protocol imports by aliasing them to their non-prefixed versions
        // This is needed for packages like critters that use the node: prefix
        config.resolve.alias = {
            ...config.resolve.alias,
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
            // emits .map files for server
            config.devtool = "source-map";
        }
        config.resolve.fallback = {
            ...config.resolve.fallback,
            crypto: false
        };
        if (isSelfHosted) {
            // To solve workos security vulnerability
            config.plugins.push(
                new webpack.NormalModuleReplacementPlugin(
                    /@workos-inc\/node/,
                    require.resolve("./src/server/workos-stub.ts")
                )
            );
        }

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
        return config;
    },
    output: isStandalone ? "standalone" : undefined
};

function withVercelEnv(config: NextConfig): NextConfig {
    return {
        ...config,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID, // skew protection
        productionBrowserSourceMaps: isMinificationDisabled,
        reactProductionProfiling: false,
        experimental: {
            ...config.experimental,
            serverSourceMaps: true
        }
    };
}

export default (phase: string): NextConfig => {
    const isDev = phase === PHASE_DEVELOPMENT_SERVER;

    /**
     * Do not enable bundle analysis for local development.
     */
    if (isDev) {
        return withVercelEnv(nextConfig);
    }

    const withBundleAnalyzer = NextBundleAnalyzer({
        enabled: process.env.ANALYZE === "1"
    });

    return withBundleAnalyzer(withVercelEnv(nextConfig));
};
