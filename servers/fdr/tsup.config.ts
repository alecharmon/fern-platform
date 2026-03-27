import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";
import { defineConfig } from "tsup";

export default defineConfig({
    sourcemap: true,
    external: ["@prisma/client", ".prisma/client"],
    noExternal: [
        "jose",
        "date-fns",
        "@orpc/openapi",
        "@orpc/server",
        "@orpc/contract",
        "@orpc/standard-server",
        "@orpc/standard-server-node",
        "@orpc/shared",
        "@orpc/experimental-pino",
        "posthog-node",
        "@sentry/node"
    ],
    esbuildPlugins: process.env.SENTRY_AUTH_TOKEN
        ? [
              sentryEsbuildPlugin({
                  org: "buildwithfern",
                  project: "fdr",
                  authToken: process.env.SENTRY_AUTH_TOKEN
              })
          ]
        : []
});
