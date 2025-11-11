import dotenv from "dotenv";
import { execa } from "execa";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SELF_HOSTED_CONTAINER_NAME, setup, teardown } from "./setupSelfHostedDocs";
import { getContainerId } from "./testHelpers";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function getSingleNodeContainerId() {
    return await getContainerId("name=" + SELF_HOSTED_CONTAINER_NAME);
}

beforeAll(async () => {
    await setup();
}, 30000);

afterAll(async () => {
    await teardown();
}, 30000);

describe("Health check server is running", () => {
    it("health check server is accessible on port 8081", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const maxRetries = 30;
        const retryDelay = 1000;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const { stdout: curlOutput } = await execa("docker", [
                    "exec",
                    containerId,
                    "curl",
                    "-s",
                    "-o",
                    "/dev/null",
                    "-w",
                    "%{http_code}",
                    "http://localhost:8081/liveness"
                ]);

                if (curlOutput === "200") {
                    expect(curlOutput).toBe("200");
                    return;
                }

                lastError = new Error(`Health check returned unexpected status: ${curlOutput}`);
            } catch (error) {
                lastError = error as Error;
            }

            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }

        throw new Error(
            `Health check server failed to become accessible after ${maxRetries} attempts: ${lastError?.message}`
        );
    });
});

describe("Liveness probe endpoint", () => {
    it("returns 200 when all services are running", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: httpCode } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "http://localhost:8081/liveness"
        ]);
        expect(httpCode).toBe("200");
    });

    it("returns valid JSON response", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/liveness"
        ]);

        const json = JSON.parse(response);
        expect(json).toHaveProperty("status");
        expect(json).toHaveProperty("check");
        expect(json).toHaveProperty("exitCode");
        expect(json).toHaveProperty("message");
        expect(json).toHaveProperty("timestamp");
        expect(json.check).toBe("liveness");
        expect(json.status).toBe("healthy");
        expect(json.exitCode).toBe(0);
    });

    it("response message confirms all critical services are running", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/liveness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).toContain("Liveness check PASSED");
        expect(json.message).toContain("All critical services are running");
    });

    it("checks PostgreSQL PID", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/liveness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).not.toContain("PostgreSQL");
        expect(json.message).not.toContain("not running");
    });

    it("checks MinIO PID", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/liveness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).not.toContain("MinIO");
        expect(json.message).not.toContain("not running");
    });

    it("checks FDR PID", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/liveness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).not.toContain("FDR");
        expect(json.message).not.toContain("not running");
    });

    it("checks Next.js docs server PID", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/liveness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).not.toContain("Next.js Docs");
        expect(json.message).not.toContain("not running");
    });
});

describe("Readiness probe endpoint", () => {
    it("returns 200 when all services are ready", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: httpCode } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "http://localhost:8081/readiness"
        ]);
        expect(httpCode).toBe("200");
    });

    it("returns valid JSON response", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/readiness"
        ]);

        const json = JSON.parse(response);
        expect(json).toHaveProperty("status");
        expect(json).toHaveProperty("check");
        expect(json).toHaveProperty("exitCode");
        expect(json).toHaveProperty("message");
        expect(json).toHaveProperty("timestamp");
        expect(json.check).toBe("readiness");
        expect(json.status).toBe("ready");
        expect(json.exitCode).toBe(0);
    });

    it("response message confirms all critical services are ready", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/readiness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).toContain("Readiness check PASSED");
        expect(json.message).toContain("All critical services are ready");
    });

    it("verifies PostgreSQL is ready", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/readiness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).toContain("PostgreSQL is ready");
    });

    it("verifies MinIO is ready", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/readiness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).toContain("MinIO is ready");
    });

    it("verifies FDR is ready", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/readiness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).toContain("FDR is ready");
    });

    it("verifies Next.js docs server is ready", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/readiness"
        ]);

        const json = JSON.parse(response);
        expect(json.message).toContain("Next.js Docs is ready");
    });
});

describe("Legacy health endpoint", () => {
    it("returns 200 when services are ready", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: httpCode } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "http://localhost:8081/health"
        ]);
        expect(httpCode).toBe("200");
    });

    it("returns valid JSON response", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/health"
        ]);

        const json = JSON.parse(response);
        expect(json).toHaveProperty("status");
        expect(json).toHaveProperty("check");
        expect(json).toHaveProperty("exitCode");
        expect(json).toHaveProperty("message");
        expect(json).toHaveProperty("timestamp");
        expect(json.check).toBe("health");
        expect(json.status).toBe("ok");
        expect(json.exitCode).toBe(0);
    });

    it("provides backward compatibility with readiness check", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: healthResponse } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/health"
        ]);

        const { stdout: readinessResponse } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/readiness"
        ]);

        const healthJson = JSON.parse(healthResponse);
        const readinessJson = JSON.parse(readinessResponse);

        expect(healthJson.exitCode).toBe(readinessJson.exitCode);
        expect(healthJson.message).toContain("Readiness check");
    });
});

describe("Health check endpoints error handling", () => {
    it("returns 404 for unknown endpoints", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: httpCode } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "http://localhost:8081/unknown"
        ]);
        expect(httpCode).toBe("404");
    });

    it("returns helpful error message for unknown endpoints", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: response } = await execa("docker", [
            "exec",
            containerId,
            "curl",
            "-s",
            "http://localhost:8081/unknown"
        ]);

        const json = JSON.parse(response);
        expect(json).toHaveProperty("error");
        expect(json).toHaveProperty("message");
        expect(json.error).toBe("Not Found");
        expect(json.message).toContain("Available endpoints");
        expect(json.message).toContain("/liveness");
        expect(json.message).toContain("/readiness");
        expect(json.message).toContain("/health");
    });
});

describe("Health check PID file", () => {
    it("PID file exists and contains service PIDs", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: pidFileContent } = await execa("docker", [
            "exec",
            containerId,
            "cat",
            "/tmp/fern-services.json"
        ]);

        expect(pidFileContent).toContain("postgres_pid");
        expect(pidFileContent).toContain("meili_pid");
        expect(pidFileContent).toContain("minio_pid");
        expect(pidFileContent).toContain("fdr_pid");
        expect(pidFileContent).toContain("docs_pid");
    });

    it("PID file contains valid process IDs", async () => {
        const containerId = await getSingleNodeContainerId();
        expect(containerId).toBeTruthy();

        const { stdout: pidFileContent } = await execa("docker", [
            "exec",
            containerId,
            "cat",
            "/tmp/fern-services.json"
        ]);

        const pids = JSON.parse(pidFileContent);

        expect(pids.postgres_pid).toBeGreaterThan(0);
        expect(pids.minio_pid).toBeGreaterThan(0);
        expect(pids.fdr_pid).toBeGreaterThan(0);
        expect(pids.docs_pid).toBeGreaterThan(0);
        // meili_pid might be 0 if not running (non-critical)
    });
});
