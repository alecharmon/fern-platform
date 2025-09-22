import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    teardownTimeout: 60000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially
      },
    },
    globalSetup: ["./src/__test__/setupSharedDocker.ts"],
    include: [
      "./src/__test__/singleNode.test.ts",
      "./src/__test__/multiNode.test.ts",
    ],
  },
});
