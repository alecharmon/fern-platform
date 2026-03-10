import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import rspack from "@rspack/core";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import withRspack from "next-rspack";
import webpack from "webpack";

const isVercelPreview = process.env.VERCEL_ENV === "preview";
const isRspackEnabled = false; // NOTE: temp disabling for dev, since it was running into issues post next 16 upgrade
const isSentryEnabled = process.env.NODE_ENV === "production" && !isVercelPreview;

const CSP_HEADER = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' *.usepylon.com *.posthog.com *.pusher.com d3vl36l12sfx26.cloudfront.net cdn.jsdelivr.net va.vercel-scripts.com assets.calendly.com${isVercelPreview ? " vercel.live *.vercel.live" : ""};
  worker-src 'self' blob:;
  connect-src 'self' * ws:;
  style-src 'self' 'unsafe-inline' *;
  font-src 'self' *;
  img-src 'self' * data: blob:;
  frame-src 'self' *;
  object-src 'self' *;
  media-src 'self' *;
`.replace(/\n/g, "");

let nextConfig: NextConfig = {
    productionBrowserSourceMaps: !isVercelPreview,
    outputFileTracingExcludes: {
        "./": ["**/*.map"]
    },
    transpilePackages: [
        "@fern-api/docs-utils",
        "@fern-api/user-permissions",
        "@fern-docs/components",
        "@fern-docs/mdx",
        "@fern-ui/loadable"
    ],
    cacheComponents: true,
    experimental: {
        optimizePackageImports: ["lowlight", "lucide-react", "recharts", "framer-motion", "es-toolkit", "dayjs"]
    },
    turbopack: {
        resolveAlias: {
            "@fern-api/venus-api-sdk": "./node_modules/@fern-api/venus-api-sdk/dist/cjs/index.js"
        },
        rules: {
            "*.frag": {
                loaders: ["raw-loader"],
                as: "*.js"
            },
            "*.vert": {
                loaders: ["raw-loader"],
                as: "*.js"
            },
            "*.glsl": {
                loaders: ["raw-loader"],
                as: "*.js"
            }
        }
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
                port: "",
                pathname: "/u/**",
                search: "?v=4"
            },
            {
                protocol: "https",
                hostname: "s.gravatar.com",
                port: "",
                pathname: "/avatar/**"
            },
            {
                protocol: "https",
                hostname: "files.buildwithfern.com",
                port: "",
                pathname: "/**"
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
                port: "",
                pathname: "/**"
            },
            {
                protocol: "https",
                hostname: "prod-docs-homepage-images.s3.us-east-1.amazonaws.com",
                port: "",
                pathname: "/**"
            },
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
                port: "",
                pathname: "/**"
            }
        ],
        qualities: [75, 100]
    },
    webpack: (config, { isServer, dev }) => {
        // Enable source maps for debugging in development
        if (dev) {
            config.devtool = "source-map";
        }

        const externalModules = [
            // mongodb subdependencies are optional, and need to be externalized for rspack.
            // add them + install dependencies as needed.
            "kerberos",
            "@mongodb-js/zstd",
            "@aws-sdk/credential-providers",
            "gcp-metadata",
            "snappy",
            "mongodb-client-encryption",
            // monaco-editor is accidentally bundled, but actually uses the jsdelivr cdn
            // so we need to externalize it
            "monaco-editor",
            // mermaid is explicitly externalized via jsdelivr cdn (similar to monaco-editor)
            // so we also need to externalize it
            "mermaid"
        ];
        if (Array.isArray(config.externals)) {
            config.externals.push(...externalModules);
        } else {
            config.externals = [...(config.externals ? [config.externals] : []), ...externalModules];
        }

        // Configure rspack/webpack to use CommonJS for @fern-api/venus-api-sdk specifically
        // The ESM build of venus-api-sdk is broken, so we need to force it to use CJS
        config.resolve ??= {};
        config.resolve.alias ??= {};
        config.resolve.alias["@fern-api/venus-api-sdk"] = require.resolve(
            "./node_modules/@fern-api/venus-api-sdk/dist/cjs/index.js"
        );

        config.plugins ??= [];
        config.plugins.push(
            new (isRspackEnabled ? rspack : webpack).DefinePlugin({
                "process.env.NEXT_PUBLIC_BUILD_TIMESTAMP": JSON.stringify(new Date().toISOString()),
                "process.env.NEXT_PUBLIC_FERN_CLI_ENV": JSON.stringify(process.env.FERN_CLI_ENV || ""),
                "process.env.NEXT_PUBLIC_VERCEL_ENV": JSON.stringify(process.env.VERCEL_ENV || "")
            })
        );

        // Suppress warning about dynamic import in mermaid loader
        config.ignoreWarnings = [
            ...(config.ignoreWarnings || []),
            {
                module: /loadMermaid\.ts$/,
                message: /Critical dependency: the request of a dependency is an expression/
            }
        ];

        // esbuild is only used on the server (mdx-bundler), so only externalize it there
        if (isServer) {
            if (Array.isArray(config.externals)) {
                config.externals.push("esbuild");
            } else {
                config.externals = [...(config.externals ? [config.externals] : []), "esbuild"];
            }
        }

        // ignore all test files
        // Use IgnorePlugin to ignore .test.ts and .test.tsx files
        config.plugins.push(
            new (isRspackEnabled ? rspack : webpack).IgnorePlugin({
                resourceRegExp: /\.test\.tsx?$/
            })
        );

        // rspack's internal configuration for "lib" will bundle all shared node_modules into a giant chunk,
        // so we need to kill it
        if (
            config.optimization.splitChunks.cacheGroups != null &&
            config.optimization.splitChunks.cacheGroups.lib != null
        ) {
            delete config.optimization.splitChunks.cacheGroups.lib;
        }

        // split chunks for build (not dev)
        if (config.optimization.splitChunks) {
            config.optimization.splitChunks.cacheGroups ??= {};

            // Bundle all @radix-ui/react-* packages into a single chunk
            config.optimization.splitChunks.cacheGroups.radix = {
                test: /[\\/]node_modules[\\/]@radix-ui[\\/].*/,
                name: "radix-ui",
                chunks: "all",
                enforce: true
            };
        }

        // glslify is used to import 3d shaders (WaveformComplexShader)
        // into the bundle
        // Note: rspack doesn't support webpack loaders, so we use webpack's built-in support
        config.module.rules.push({
            test: /\.(glsl|vs|fs|vert|frag)$/,
            exclude: /node_modules/,
            type: "asset/source"
        });

        // analyze the bundle using rsdoctor
        // https://rsdoctor.rs/guide/start/quick-start#nextjs
        if (process.env.RSD === "1" && ["client", "server"].includes(config.name)) {
            config.plugins.push(
                new RsdoctorRspackPlugin({
                    disableClientServer: true,
                    features: ["bundle"],
                    experiments: {
                        enableNativePlugin: true
                    },
                    output: {
                        reportDir: config.name === "server" ? "./.next/server" : "./.next"
                    }
                })
            );
        }

        return config;
    },

    // vercel chokes on monorepo compilation and we run compile before building
    typescript: {
        ignoreBuildErrors: true,
        tsconfigPath: "./tsconfig.app.json"
    },

    logging: {
        fetches: {
            fullUrl: true
        },
        incomingRequests: true
    },

    // Exclude esbuild from server bundle to avoid .d.ts parsing issues
    serverExternalPackages: ["esbuild", "@fern-api/venus-api-sdk"],

    // so it doesn't cover the theme toggle
    devIndicators: { position: "bottom-right" },

    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: CSP_HEADER
                    }
                ]
            }
        ];
    },

    // This is required to support PostHog trailing slash API requests
    skipTrailingSlashRedirect: true
};

// use rspack in development and preview builds for faster compilation
if (isRspackEnabled) {
    // @ts-expect-error NextConfig type mismatch: dashboard uses next@16 but next-rspack resolves next@15 peer dep from catalog
    nextConfig = withRspack(nextConfig);
}

// only use sentry in production
if (isSentryEnabled) {
    nextConfig = withSentryConfig(nextConfig, {
        // For all available options, see:
        // https://www.npmjs.com/package/@sentry/webpack-plugin#options

        org: "buildwithfern",
        project: "fern-dashboard",

        // Only print logs for uploading source maps in CI
        silent: !process.env.CI,

        // For all available options, see:
        // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

        // Upload a larger set of source maps for prettier stack traces (increases build time)
        widenClientFileUpload: !isVercelPreview,

        // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
        // This can increase your server load as well as your hosting bill.
        // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
        // side errors will fail.
        tunnelRoute: "/monitoring",

        sourcemaps: {
            // Note: maybe we can use these to reduce the size of the source maps, has to be tested
            // assets: "./.next/**/*.{js,js.map}",
            // ignore: ["**/node_modules/**"],
            deleteSourcemapsAfterUpload: true
        },

        // Automatically tree-shake Sentry logger statements to reduce bundle size
        disableLogger: true,

        // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
        // See the following for more information:
        // https://docs.sentry.io/product/crons/
        // https://vercel.com/docs/cron-jobs
        automaticVercelMonitors: true,

        autoInstrumentAppDirectory: false
    });
}

export default nextConfig;
