import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        exclude: ["src/__test__/**", "node_modules/**"]
    }
});
