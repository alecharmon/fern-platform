import dotenv from "dotenv";
import { execa } from "execa";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SELF_HOSTED_CONTAINER_NAME, setup, teardown } from "./setupSelfHostedDocs";
import {
    getContainerId,
    testCacheStatsEndpoint,
    testCustomComponentsPage,
    testDocsUIAccessible,
    testDocsUIElements,
    testExternalCallsBlocked,
    testFrontendCacheWorking,
    testServicesAfterPort3000Check
} from "./testHelpers";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function getSingleNodeContainerId() {
    return await getContainerId("name=" + SELF_HOSTED_CONTAINER_NAME);
}

// Setup single-node container before tests
beforeAll(async () => {
    await setup();
}, 30000); // 30 second timeout for setup

// Cleanup single-node container after tests
afterAll(async () => {
    await teardown();
}, 30000); // 30 second timeout for cleanup

describe("Self-hosted docs has a running Postgres instance", () => {
    it("Postgres is running", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        // Use TCP connection (-h localhost) instead of Unix socket for robustness
        // The socket directory is UID-scoped and may vary between runs
        const { stdout: postgresStatus } = await execa("docker", [
            "exec",
            containerId,
            "pg_isready",
            "-h",
            "localhost",
            "-p",
            "5432",
            "-U",
            "postgres",
            "-d",
            "postgres"
        ]);
        expect(postgresStatus).toContain("accepting connections");
    });

    it("fdr database exists and has tables", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        // Use TCP connection (-h localhost) instead of Unix socket for robustness
        const { stdout: dbList } = await execa("docker", [
            "exec",
            "-e",
            "PGPASSWORD=postgres",
            containerId,
            "psql",
            "-h",
            "localhost",
            "-p",
            "5432",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-t",
            "-c",
            "SELECT 1 FROM pg_database WHERE datname='fdr'"
        ]);
        expect(dbList.trim()).toBe("1");

        const { stdout: tableList } = await execa("docker", [
            "exec",
            "-e",
            "PGPASSWORD=postgres",
            containerId,
            "psql",
            "-h",
            "localhost",
            "-p",
            "5432",
            "-U",
            "postgres",
            "-d",
            "fdr",
            "-t",
            "-c",
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
        ]);
        const tableCount = parseInt(tableList.trim());
        expect(tableCount).toBeGreaterThan(0);
    });

    it("Minio Bucket has docs", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();
        // Get the UID the container is running as to find the correct MC_CONFIG_DIR
        // run.sh uses UID-scoped directories to avoid permission conflicts
        const { stdout: containerUid } = await execa("docker", ["exec", containerId, "id", "-u"]);
        const uid = containerUid.trim();
        // Pass MC_CONFIG_DIR to docker exec since run.sh configures mc with this custom config directory
        const { stdout: minioStatus } = await execa("docker", [
            "exec",
            "-e",
            `MC_CONFIG_DIR=/tmp/mc-config-${uid}`,
            containerId,
            "mc",
            "ls",
            "minio"
        ]);
        const orgName = "example-org"; // this comes from the fern folder we mount
        expect(minioStatus).toContain(`${orgName}.docs.buildwithfern.com`);
    });
});

describe("Self-hosted docs has a running MinIO instance", () => {
    it("health check passes", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: curlOutput } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "http://localhost:9000/minio/health/live"
        ]);
        expect(curlOutput).toBe("200");
    });
});

describe("FDR server is running and api endpoints are available", () => {
    it("health check passes", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: curlOutput } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "http://localhost:8080/health"
        ]);
        expect(curlOutput).toBe("200");
    });
});

describe("Network isolation is working", () => {
    it("external calls are blocked", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testExternalCallsBlocked(containerId);
    });
});

describe("Port 3000 does not cause failures", () => {
    it("services continue to work after checking port 3000", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testServicesAfterPort3000Check(containerId);
    });
});

describe("Docs UI is functional", () => {
    it("docs UI is accessible and returns valid HTML", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testDocsUIAccessible(containerId);
    });

    it("docs UI contains expected interactive elements", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testDocsUIElements(containerId);
    });
});

describe("Frontend cache is working", () => {
    it("cache stats endpoint is accessible and returns valid data", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testCacheStatsEndpoint(containerId);
    });

    it("cache is working and serving cached responses", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testFrontendCacheWorking(containerId);
    });
});

describe("Custom components support", () => {
    it("custom components page is accessible and renders the custom component", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testCustomComponentsPage(containerId);
    });
});
