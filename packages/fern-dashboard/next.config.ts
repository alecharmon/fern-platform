/* eslint-disable turbo/no-undeclared-env-vars */

import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import rspack from "@rspack/core";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import withRspack from "next-rspack";
import webpack from "webpack";

const isRspackEnabled = process.env.NODE_ENV === "development";

const CSP_HEADER = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' *.usepylon.com *.posthog.com *.pusher.com d3vl36l12sfx26.cloudfront.net cdn.jsdelivr.net va.vercel-scripts.com;
  worker-src 'self' blob:;
  connect-src 'self' * ws:;
  style-src 'self' 'unsafe-inline' *.usepylon.com *.posthog.com cdn.jsdelivr.net cdnjs.cloudflare.com;
  font-src 'self' pylon-avatars.s3.us-west-1.amazonaws.com *.usepylon.com *.buildwithfern.com cdn.jsdelivr.net;
  img-src 'self' *;
  frame-src 'self' *;
  object-src 'self' *;
  media-src 'self' *;
`.replace(/\n/g, "");

let nextConfig: NextConfig = {
    outputFileTracingExcludes: {
        "./": ["**/*.map"]
    },
    transpilePackages: ["@fern-api/docs-utils", "@fern-docs/components", "@fern-ui/loadable"],
    experimental: {
        webpackBuildWorker: true,
        optimizePackageImports: [
            // this will separate the `createLowlight` from the `all` import
            "lowlight"
        ],
        useCache: true
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
                hostname: "files.buildwithfern.com",
                port: "",
                pathname: "/**"
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
                port: "",
                pathname: "/**"
            }
        ]
    },
    webpack: (config, { isServer }) => {
        config.externals.push(
            "sharp",
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
            config.externals = config.externals || [];
            config.externals.push("esbuild");
        }

        // ignore all test files
        // Use IgnorePlugin to ignore .test.ts and .test.tsx files
        config.plugins ??= [];
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

    // linting is already handled in ci, so this is not needed
    eslint: {
        ignoreDuringBuilds: true
    },

    // Exclude esbuild from server bundle to avoid .d.ts parsing issues
    serverExternalPackages: ["esbuild"],

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

// only use rspack in development
if (isRspackEnabled) {
    nextConfig = withRspack(nextConfig);
}

if (process.env.NODE_ENV === "production") {
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
        widenClientFileUpload: false,

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
        automaticVercelMonitors: true
    });
}

export default nextConfig;
