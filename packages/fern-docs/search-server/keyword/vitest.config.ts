import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: false,
                maxForks: 1,
                minForks: 1,
                isolate: true,
                execArgv: ["--max-old-space-size=6144"]
            }
        },
        fileParallelism: false,
        testTimeout: 120_000,
        retry: 1,
        exclude: ["**/node_modules/**", "**/dist/**"]
    }
});
