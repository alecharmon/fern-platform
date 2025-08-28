/* eslint-disable turbo/no-undeclared-env-vars */
import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs";

const CSP_HEADER = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' *.usepylon.com *.posthog.com *.pusher.com d3vl36l12sfx26.cloudfront.net cdn.jsdelivr.net;
  connect-src 'self' * ws:;
  style-src 'self' 'unsafe-inline' *.usepylon.com *.posthog.com cdn.jsdelivr.net;
  font-src 'self' pylon-avatars.s3.us-west-1.amazonaws.com *.usepylon.com *.buildwithfern.com;
  img-src 'self' *;
  frame-src 'self' *;
  object-src 'self' *;
  media-src 'self' *;
`.replace(/\n/g, "");

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "./": ["**/*.map"],
  },
  transpilePackages: [
    /**
     * Monorepo packages that are not transpiled by default.
     *
     * pnpm list --filter=@fern-dashboard/ui --only-projects --prod --recursive --depth=Infinity --json | jq -r '[.. | objects | select(.version | .!=null) | select(.version | startswith("link:")) | .from] | unique'
     */
    "@fern-api/fdr-sdk",
    "@fern-ui/loadable",
    "@fern-api/ui-core-utils",
  ],
  experimental: {
    optimizePackageImports: [],
    useCache: true,
    ppr: "incremental",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/u/**",
        search: "?v=4",
      },
      {
        protocol: "https",
        hostname: "files.buildwithfern.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  webpack: (webpackConfig, { isServer }) => {
    webpackConfig.externals.push("sharp");

    // esbuild is only used on the server (mdx-bundler), so only externalize it there
    if (isServer) {
      webpackConfig.externals = webpackConfig.externals || [];
      webpackConfig.externals.push("esbuild");
    }

    webpackConfig.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: [
        "raw-loader",
        {
          loader: "glslify-loader",
          options: {
            transform: ["glslify-import"],
          },
        },
      ],
    });
    return webpackConfig;
  },

  // vercel chokes on monorepo compilation and we run compile before building
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: "./tsconfig.app.json",
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
            value: CSP_HEADER,
          },
        ],
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default withSentryConfig(nextConfig, {
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
    deleteSourcemapsAfterUpload: true,
  },

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
