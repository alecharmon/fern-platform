import { defineConfig } from "tsup";

export default defineConfig({
    external: ["@prisma/client", ".prisma/client"],
    noExternal: [
        "jose",
        "@orpc/openapi",
        "@orpc/server",
        "@orpc/contract",
        "@orpc/standard-server",
        "@orpc/standard-server-node",
        "@orpc/shared",
        "@orpc/experimental-pino"
    ]
});
