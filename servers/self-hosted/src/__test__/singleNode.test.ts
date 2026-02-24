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
    testFilesDownload,
    testFilesPathTraversalBlocked,
    testFrontendCacheWorking,
    testSearchEndpoint,
    testSearchSensitiveEndpointsBlocked,
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

    it("SeaweedFS Bucket has docs", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();
        const { stdout: bucketList } = await execa("docker", [
            "exec",
            containerId,
            "sh",
            "-c",
            "echo 's3.bucket.list' | weed shell -master=localhost:9333 2>/dev/null"
        ]);
        const orgName = "example-org";
        expect(bucketList).toContain(`${orgName}.docs.buildwithfern.com`);
    });
});

describe("Self-hosted docs has a running SeaweedFS instance", () => {
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
            "http://localhost:9333/cluster/status"
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

describe("File serving via _files endpoint", () => {
    it("path traversal attempts are blocked with 400", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testFilesPathTraversalBlocked(containerId);
    });

    it("can download a real file from SeaweedFS", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testFilesDownload(containerId);
    }, 60000);
});

describe("MeiliSearch search functionality", () => {
    it("search endpoint returns valid results", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testSearchEndpoint(containerId);
    }, 60000);

    it("sensitive search endpoints are blocked", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        await testSearchSensitiveEndpointsBlocked(containerId);
    }, 60000);
});
