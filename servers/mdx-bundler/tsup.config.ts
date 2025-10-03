import { defineConfig } from "tsup";

export default defineConfig({
    external: ["esbuild", "typescript"],
    esbuildOptions(options) {
        options.target = "node22";
    }
});
