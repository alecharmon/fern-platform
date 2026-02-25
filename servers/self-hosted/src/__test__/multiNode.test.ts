import dotenv from "dotenv";
import { execa } from "execa";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MULTINODE_INSTANCES, MULTINODE_PROJECT_NAME, setup, teardown } from "./setupMultinodeDocs";
import {
    testDocsUIAccessible,
    testDocsUIElements,
    testExternalCallsBlocked,
    testFdrHealth,
    testSeaweedFSHealth,
    testServicesAfterPort3000Check
} from "./testHelpers";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function getMultinodeContainerId(serviceName: string) {
    const containerName = `${MULTINODE_PROJECT_NAME}-${serviceName}`;
    // Use docker ps with exact container name
    const { stdout: containerId } = await execa("docker", ["ps", "-q", "--filter", `name=^${containerName}$`]);
    const trimmedId = containerId.trim();
    if (!trimmedId) {
        throw new Error(`No container found with name: ${containerName}`);
    }
    return trimmedId;
}

// Setup multi-node containers before tests
beforeAll(async () => {
    await setup();
}, 60000); // 30 second timeout for setup

// Cleanup multi-node containers after tests
afterAll(async () => {
    await teardown();
}, 60000); // 30 second timeout for cleanup

// Multi-node tests - Multiple instances of the same container
describe("Multi-node self-hosted docs deployment", () => {
    describe("Multiple container instances", () => {
        it("can run multiple instances simultaneously", async () => {
            // Get container IDs for all instances and verify they exist
            for (const instance of MULTINODE_INSTANCES) {
                const containerId = await getMultinodeContainerId(instance);
                expect(containerId).toBeTruthy();
                console.log(`Container ${instance} ID: ${containerId}`);
            }
        });

        it("each instance has independent FDR server", async () => {
            // Test FDR server in first instance (from inside container)
            const containerId1 = await getMultinodeContainerId(MULTINODE_INSTANCES[0]);
            await expect(testFdrHealth(containerId1)).resolves.not.toThrow();

            // Test FDR server in second instance (from inside container)
            const containerId2 = await getMultinodeContainerId(MULTINODE_INSTANCES[1]);
            await expect(testFdrHealth(containerId2)).resolves.not.toThrow();

            // Test FDR server in third instance (from inside container)
            const containerId3 = await getMultinodeContainerId(MULTINODE_INSTANCES[2]);
            await expect(testFdrHealth(containerId3)).resolves.not.toThrow();
        });

        it("each instance has independent SeaweedFS storage", async () => {
            // Test SeaweedFS in first instance (from inside container)
            const containerId1 = await getMultinodeContainerId(MULTINODE_INSTANCES[0]);
            await testSeaweedFSHealth(containerId1);

            // Test SeaweedFS in second instance (from inside container)
            const containerId2 = await getMultinodeContainerId(MULTINODE_INSTANCES[1]);
            await testSeaweedFSHealth(containerId2);

            // Test SeaweedFS in third instance (from inside container)
            const containerId3 = await getMultinodeContainerId(MULTINODE_INSTANCES[2]);
            await testSeaweedFSHealth(containerId3);

            expect(containerId1).toBeDefined();
            expect(containerId2).toBeDefined();
            expect(containerId3).toBeDefined();
        });

        it("instances don't interfere with each other", async () => {
            // Test that all instances respond independently (from inside containers)
            for (const instance of MULTINODE_INSTANCES) {
                const containerId = await getMultinodeContainerId(instance);
                await expect(testFdrHealth(containerId)).resolves.not.toThrow();
            }
        });
    });

    describe("Network isolation is working for all instances", () => {
        it("external calls are blocked in first instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[0]);
            expect(containerId).toBeTruthy();

            await testExternalCallsBlocked(containerId);
        });

        it("external calls are blocked in second instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[1]);
            expect(containerId).toBeTruthy();

            await testExternalCallsBlocked(containerId);
        });

        it("external calls are blocked in third instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[2]);
            expect(containerId).toBeTruthy();

            await testExternalCallsBlocked(containerId);
        });
    });

    describe("Port 3000 does not cause failures in any instance", () => {
        it("services continue to work after checking port 3000 in first instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[0]);
            expect(containerId).toBeTruthy();

            await testServicesAfterPort3000Check(containerId);
        });

        it("services continue to work after checking port 3000 in second instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[1]);
            expect(containerId).toBeTruthy();

            await testServicesAfterPort3000Check(containerId);
        });

        it("services continue to work after checking port 3000 in third instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[2]);
            expect(containerId).toBeTruthy();

            await testServicesAfterPort3000Check(containerId);
        });
    });

    describe("Docs UI is functional in all instances", () => {
        it("docs UI is accessible in first instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[0]);
            expect(containerId).toBeTruthy();

            await testDocsUIAccessible(containerId);
        });

        it("docs UI is accessible in second instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[1]);
            expect(containerId).toBeTruthy();

            await testDocsUIAccessible(containerId);
        });

        it("docs UI is accessible in third instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[2]);
            expect(containerId).toBeTruthy();

            await testDocsUIAccessible(containerId);
        });

        it("docs UI contains expected elements in first instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[0]);
            expect(containerId).toBeTruthy();

            await testDocsUIElements(containerId);
        });

        it("docs UI contains expected elements in second instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[1]);
            expect(containerId).toBeTruthy();

            await testDocsUIElements(containerId);
        });

        it("docs UI contains expected elements in third instance", async () => {
            const containerId = await getMultinodeContainerId(MULTINODE_INSTANCES[2]);
            expect(containerId).toBeTruthy();

            await testDocsUIElements(containerId);
        });
    });
});
