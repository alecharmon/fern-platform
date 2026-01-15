import { defineConfig } from "tsup";

export default defineConfig({
    external: ["@prisma/client", ".prisma/client"],
    noExternal: ["jose"]
});
