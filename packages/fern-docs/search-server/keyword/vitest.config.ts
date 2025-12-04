import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: false,
                maxForks: 1,
                minForks: 1
            }
        },
        fileParallelism: false,
        retry: 1
    }
});
