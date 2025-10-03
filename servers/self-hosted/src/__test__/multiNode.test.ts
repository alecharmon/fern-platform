import dotenv from "dotenv";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MULTINODE_INSTANCES, MULTINODE_PROJECT_NAME } from "./setupMultinodeDocs";
import { getContainerId, testFdrHealthExternal, testMinioHealthExternal, testMultipleInstances } from "./testHelpers";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function getMultinodeContainerId(serviceName: string) {
    return await getContainerId(`name=${MULTINODE_PROJECT_NAME}-${serviceName}`);
}

// Setup multi-node containers before tests
beforeAll(async () => {
    const { setup } = await import("./setupMultinodeDocs");
    await setup();
}, 30000); // 30 second timeout for setup

// Cleanup multi-node containers after tests
afterAll(async () => {
    const { teardown } = await import("./setupMultinodeDocs");
    await teardown();
}, 30000); // 30 second timeout for cleanup

// Multi-node tests - Multiple instances of the same container
describe("Multi-node self-hosted docs deployment", () => {
    describe("Multiple container instances", () => {
        it("can run multiple instances simultaneously", async () => {
            const instances = [];

            // Get container IDs for all instances
            for (let i = 0; i < MULTINODE_INSTANCES.length; i++) {
                const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[i]);
                expect(containerId).toBeTruthy();

                instances.push({
                    containerId,
                    externalPort: 8080 + i // Ports 8080, 8081, 8082
                });
            }

            // Test that all instances work simultaneously
            await testMultipleInstances(instances);
        });

        it("each instance has independent FDR server", async () => {
            // Test FDR server in first instance
            await testFdrHealthExternal("", 8080);

            // Test FDR server in second instance
            await testFdrHealthExternal("", 8081);

            // Test FDR server in third instance
            await testFdrHealthExternal("", 8082);
        });

        it("each instance has independent MinIO", async () => {
            // Test MinIO in first instance
            await testMinioHealthExternal(9000);

            // Test MinIO in second instance
            await testMinioHealthExternal(9002);

            // Test MinIO in third instance
            await testMinioHealthExternal(9004);
        });

        it("instances don't interfere with each other", async () => {
            // Test that all instances respond independently
            const ports = [8080, 8081, 8082];

            for (const port of ports) {
                await testFdrHealthExternal("", port);
            }
        });
    });
});
