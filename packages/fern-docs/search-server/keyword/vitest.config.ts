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
                isolate: true
            }
        },
        fileParallelism: false,
        testTimeout: 120_000,
        retry: 1
    }
});
