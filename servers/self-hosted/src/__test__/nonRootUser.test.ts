import { execa } from "execa";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FERN_NETWORK_NAME, SELF_HOSTED_IMAGE_TAG_NAME } from "./setupSharedDocker";
import { testDocsUIAccessible, testFdrHealth } from "./testHelpers";

const NON_ROOT_CONTAINER_NAME = "fern-self-hosted-non-root";
const RESTRICTED_CONTAINER_NAME = "fern-self-hosted-restricted";
const FERN_DIR = path.join(__dirname, "../../fern");

async function removeContainer(containerName: string) {
    try {
        await execa("docker", ["rm", "-f", containerName]);
    } catch (_) {}
}

// Clean up any existing containers before tests
beforeAll(async () => {
    await removeContainer(NON_ROOT_CONTAINER_NAME);
    await removeContainer(RESTRICTED_CONTAINER_NAME);
});

// Clean up containers after tests
afterAll(async () => {
    await removeContainer(NON_ROOT_CONTAINER_NAME);
    await removeContainer(RESTRICTED_CONTAINER_NAME);
});

describe("Self-hosted container with security restrictions", () => {
    describe("Running with docker:run:restricted equivalent restrictions", () => {
        it("Should successfully start with fallback to /tmp when running with full security restrictions", async () => {
            console.log("Testing container with docker:run:restricted equivalent restrictions (UID 65532)...");

            let containerId: string | undefined;
            try {
                // Start container with exact same restrictions as pnpm docker:run:restricted
                const { stdout: containerIdOutput } = await execa(
                    "docker",
                    [
                        "run",
                        "--name",
                        NON_ROOT_CONTAINER_NAME,
                        "-d", // Run in detached mode to check logs
                        "--network",
                        FERN_NETWORK_NAME,
                        "--user",
                        "65532:65532", // Anduril's specific UID/GID
                        "--security-opt",
                        "no-new-privileges", // Same as docker:run:restricted
                        "--cap-drop",
                        "ALL", // Same as docker:run:restricted
                        "-v",
                        `${FERN_DIR}:/fern:ro`, // Same as docker:run:restricted
                        "--tmpfs",
                        "/data:rw,size=1g,mode=0777,uid=65532,gid=65532",
                        SELF_HOSTED_IMAGE_TAG_NAME
                    ],
                    {
                        timeout: 5000
                    }
                );

                containerId = containerIdOutput.trim();
                console.log("Container started with ID:", containerId);

                // Wait for PostgreSQL to initialize
                console.log("Waiting for PostgreSQL to initialize...");
                await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

                // Check container logs
                const { stdout: logs } = await execa("docker", ["logs", containerId], {
                    reject: false
                });

                console.log("Container logs excerpt:");
                const logLines = logs.split("\n");
                const relevantLogs = logLines.filter(
                    (line) =>
                        line.includes("PostgreSQL") ||
                        line.includes("WARNING") ||
                        line.includes("/tmp") ||
                        line.includes("successfully")
                );
                console.log(relevantLogs.join("\n"));

                // Check for successful PostgreSQL initialization in UID-scoped /tmp directory
                // The path is now /tmp/postgresql-{UID}/data to avoid permission conflicts
                expect(logs).toMatch(/Initializing PostgreSQL cluster in \/tmp\/postgresql-\d+\/data/);
                expect(logs).toContain("PostgreSQL started successfully");

                // Check if PostgreSQL is actually running
                // Extract the PGBASE path from logs to use for pg_isready
                const pgbaseMatch = logs.match(/DATABASE_URL configured for Unix socket in (\/tmp\/postgresql-\d+)/);
                const pgbase = pgbaseMatch ? pgbaseMatch[1] : "/tmp/postgresql-65532";
                const { stdout: psOutput } = await execa(
                    "docker",
                    ["exec", containerId, "pg_isready", "-h", pgbase, "-p", "5432"],
                    {
                        reject: false
                    }
                );

                expect(psOutput).toContain("accepting connections");

                console.log("✓ Container successfully started with PostgreSQL in /tmp");

                // Test network isolation
                console.log("Testing network isolation...");
                const { exitCode: curlExitCode } = await execa(
                    "docker",
                    [
                        "exec",
                        containerId,
                        "curl",
                        "-s",
                        "-o",
                        "/dev/null",
                        "-w",
                        "%{http_code}",
                        "--connect-timeout",
                        "5",
                        "http://www.google.com"
                    ],
                    {
                        reject: false
                    }
                );

                // Should fail to connect
                expect(curlExitCode).not.toBe(0);
                console.log("✓ External calls are blocked as expected");
            } finally {
                // Clean up container
                if (containerId) {
                    try {
                        await execa("docker", ["stop", containerId]);
                        await execa("docker", ["rm", containerId]);
                    } catch {}
                }
            }
        });
    });

    describe("Running with full security restrictions (verification test)", () => {
        it("Should start successfully with security restrictions and verify all services", async () => {
            console.log("Testing container with full security restrictions (verification)...");

            let containerId: string | undefined;
            try {
                // Run with exact same restrictions as pnpm docker:run:restricted
                // This is a verification test to ensure all services start correctly
                const { stdout: containerIdOutput } = await execa(
                    "docker",
                    [
                        "run",
                        "--name",
                        RESTRICTED_CONTAINER_NAME,
                        "-d",
                        "--network",
                        FERN_NETWORK_NAME,
                        "--user",
                        "65532:65532", // Non-root user
                        "--security-opt",
                        "no-new-privileges", // Similar to allowPrivilegeEscalation: false
                        "--cap-drop",
                        "ALL", // Drop all capabilities
                        "-v",
                        `${FERN_DIR}:/fern:ro`, // Read-only mount for fern
                        "--tmpfs",
                        "/data:rw,size=1g,mode=0777,uid=65532,gid=65532",
                        SELF_HOSTED_IMAGE_TAG_NAME
                    ],
                    {
                        timeout: 5000
                    }
                );

                containerId = containerIdOutput.trim();
                console.log("Container started with ID:", containerId);

                // Wait for services to initialize
                console.log("Waiting for services to initialize...");
                await new Promise((resolve) => setTimeout(resolve, 20000)); // Wait 20 seconds

                // Check container logs
                const { stdout: logs } = await execa("docker", ["logs", containerId], {
                    reject: false
                });

                // Check for successful startup indicators
                console.log("Checking for successful startup indicators...");

                // PostgreSQL should initialize in UID-scoped /tmp directory
                // The path is now /tmp/postgresql-{UID}/data to avoid permission conflicts
                expect(logs).toMatch(/Initializing PostgreSQL cluster in \/tmp\/postgresql-\d+\/data/);
                expect(logs).toContain("PostgreSQL started successfully");

                // Check if key services started
                expect(logs).toContain("MeiliSearch PID:");
                expect(logs).toContain("MinIO PID:");
                expect(logs).toContain("FDR server PID:");

                console.log("✓ Container successfully started with full security restrictions");

                // Test network isolation
                console.log("Testing network isolation...");
                const { exitCode: curlExitCode } = await execa(
                    "docker",
                    [
                        "exec",
                        containerId,
                        "curl",
                        "-s",
                        "-o",
                        "/dev/null",
                        "-w",
                        "%{http_code}",
                        "--connect-timeout",
                        "5",
                        "http://www.google.com"
                    ],
                    {
                        reject: false
                    }
                );

                // Should fail to connect
                expect(curlExitCode).not.toBe(0);
                console.log("✓ External calls are blocked as expected");

                // Test port 3000 doesn't cause failures
                console.log("Testing port 3000 accessibility...");
                await execa(
                    "docker",
                    ["exec", containerId, "sh", "-c", "timeout 2 nc -z localhost 3000 || echo 'Port check attempted'"],
                    {
                        reject: false
                    }
                );
                console.log("✓ Port 3000 check completed without crashing");

                // Test FDR health
                console.log("Testing FDR health endpoint...");
                await testFdrHealth(containerId);
                console.log("✓ FDR health check passed");

                // Test docs UI
                console.log("Testing docs UI accessibility...");
                await testDocsUIAccessible(containerId);
                console.log("✓ Docs UI is accessible and functional");
            } finally {
                // Clean up container
                if (containerId) {
                    try {
                        await execa("docker", ["stop", containerId]);
                        await execa("docker", ["rm", containerId]);
                    } catch {}
                }
            }
        });
    });

    describe("Diagnostic test to verify startup output", () => {
        it("Should capture detailed output for verification", async () => {
            console.log("\n=== DIAGNOSTIC TEST ===");
            console.log("Running container with restrictions to capture detailed startup...\n");

            let containerId: string | undefined;
            try {
                // Start container in detached mode to capture logs without timing out
                const { stdout: containerIdOutput } = await execa(
                    "docker",
                    [
                        "run",
                        "--name",
                        `${RESTRICTED_CONTAINER_NAME}-diagnostic`,
                        "-d",
                        "--network",
                        FERN_NETWORK_NAME,
                        "--user",
                        "65532:65532",
                        "--security-opt",
                        "no-new-privileges",
                        "--cap-drop",
                        "ALL",
                        "-v",
                        `${FERN_DIR}:/fern:ro`,
                        "--tmpfs",
                        "/data:rw,size=1g,mode=0777,uid=65532,gid=65532",
                        SELF_HOSTED_IMAGE_TAG_NAME
                    ],
                    {
                        timeout: 5000
                    }
                );

                containerId = containerIdOutput.trim();
                console.log("Container started with ID:", containerId);

                // Wait for services to initialize
                console.log("Waiting for services to initialize...");
                await new Promise((resolve) => setTimeout(resolve, 25000)); // Wait 25 seconds

                // Get container logs
                const { stdout: logs } = await execa("docker", ["logs", containerId], {
                    reject: false
                });

                console.log("\n--- Full output ---");
                console.log(logs);
                console.log("--- End output ---\n");

                // Check for successful startup indicators
                expect(logs).toContain("PostgreSQL started successfully");
                expect(logs).toContain("All services started. Tailing logs to keep the container running.");

                console.log("✓ Container successfully started with full security restrictions");
            } catch (error: any) {
                console.log("Error:", error.message);

                // Try to get logs even if something failed
                if (containerId) {
                    try {
                        const { stdout: logs } = await execa("docker", ["logs", containerId], {
                            reject: false
                        });
                        console.log("\n--- Container logs ---");
                        console.log(logs);
                        console.log("--- End logs ---\n");
                    } catch {}
                }

                // Re-throw to fail the test
                throw error;
            } finally {
                // Clean up diagnostic container
                await removeContainer(`${RESTRICTED_CONTAINER_NAME}-diagnostic`);
            }
        });
    });
});
