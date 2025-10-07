import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        teardownTimeout: 60000,
        testTimeout: 120000, // 2 minutes for container startup tests
        hookTimeout: 300000, // 5 minutes for beforeAll/afterAll hooks
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: true // Run tests sequentially
            }
        },
        globalSetup: ["./src/__test__/setupSharedDocker.ts"],
        include: [
            "./src/__test__/singleNode.test.ts",
            "./src/__test__/multiNode.test.ts",
            "./src/__test__/nonRootUser.test.ts",
            "./src/__test__/noNetworkNonRoot.test.ts"
        ]
    }
});
