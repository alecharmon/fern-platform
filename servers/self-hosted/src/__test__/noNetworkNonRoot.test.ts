import { execa } from "execa";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SELF_HOSTED_IMAGE_TAG_NAME } from "./setupSharedDocker";

const NON_ROOT_CONTAINER_NAME = "fern-self-hosted-no-network-non-root";
const RESTRICTED_CONTAINER_NAME = "fern-self-hosted-no-network-restricted";
const FERN_DIR = path.join(__dirname, "../../fern");

async function removeContainer(containerName: string) {
    try {
        await execa("docker", ["rm", "-f", containerName]);
    } catch (_) {}
}

async function createNetwork() {
    try {
        await execa("docker", ["network", "create", "--internal", "fern-network"]);
    } catch (_) {
        // Network might already exist, which is fine
    }
}

async function removeNetwork() {
    try {
        await execa("docker", ["network", "rm", "fern-network"]);
    } catch (_) {}
}

// Clean up any existing containers before tests
beforeAll(async () => {
    await removeContainer(NON_ROOT_CONTAINER_NAME);
    await removeContainer(RESTRICTED_CONTAINER_NAME);
    await createNetwork();
});

// Clean up containers after tests
afterAll(async () => {
    await removeContainer(NON_ROOT_CONTAINER_NAME);
    await removeContainer(RESTRICTED_CONTAINER_NAME);
    await removeNetwork();
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
                        "--network",
                        "fern-network",
                        "--name",
                        NON_ROOT_CONTAINER_NAME,
                        "-d", // Run in detached mode to check logs
                        "--user",
                        "65532:65532", // Anduril's specific UID/GID
                        "--security-opt",
                        "no-new-privileges", // Same as docker:run:restricted
                        "--cap-drop",
                        "ALL", // Same as docker:run:restricted
                        "-v",
                        `${FERN_DIR}:/fern:ro`, // Same as docker:run:restricted
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

                // Check for successful PostgreSQL initialization in /tmp
                expect(logs).toContain("Initializing PostgreSQL cluster in /tmp/postgresql/data");
                expect(logs).toContain("PostgreSQL started successfully");

                // Check if PostgreSQL is actually running
                const { stdout: psOutput } = await execa(
                    "docker",
                    ["exec", containerId, "pg_isready", "-h", "/tmp", "-p", "5432"],
                    {
                        reject: false
                    }
                );

                expect(psOutput).toContain("accepting connections");

                console.log("✓ Container successfully started with PostgreSQL in /tmp");
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
                        "--network",
                        "fern-network",
                        "--name",
                        RESTRICTED_CONTAINER_NAME,
                        "-d",
                        "--user",
                        "65532:65532", // Non-root user
                        "--security-opt",
                        "no-new-privileges", // Similar to allowPrivilegeEscalation: false
                        "--cap-drop",
                        "ALL", // Drop all capabilities
                        "-v",
                        `${FERN_DIR}:/fern:ro`, // Read-only mount for fern
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

                // PostgreSQL should initialize in /tmp
                expect(logs).toContain("Initializing PostgreSQL cluster in /tmp/postgresql/data");
                expect(logs).toContain("PostgreSQL started successfully");

                // Check if key services started
                expect(logs).toContain("MeiliSearch PID:");
                expect(logs).toContain("MinIO PID:");
                expect(logs).toContain("FDR server PID:");

                console.log("✓ Container successfully started with full security restrictions");
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

            try {
                // Run with restrictions and capture output
                const result = await execa(
                    "docker",
                    [
                        "run",
                        "--network",
                        "fern-network",
                        "--name",
                        `${RESTRICTED_CONTAINER_NAME}-diagnostic`,
                        "--rm",
                        "--user",
                        "65532:65532",
                        "--security-opt",
                        "no-new-privileges",
                        "--cap-drop",
                        "ALL",
                        "-v",
                        `${FERN_DIR}:/fern:ro`,
                        SELF_HOSTED_IMAGE_TAG_NAME
                    ],
                    {
                        timeout: 60000,
                        reject: false,
                        all: true // Capture combined stdout and stderr
                    }
                );

                console.log("Exit code:", result.exitCode);
                console.log("\n--- Full output ---");
                console.log(result.all);
                console.log("--- End output ---\n");

                // Container should succeed with our new implementation
                // If exitCode is undefined, it means the container is still running (which is expected)
                // We should check that the container started successfully by looking at the logs
                if (result.exitCode === undefined) {
                    // Container is still running, which is expected for our test
                    expect(result.all).toContain("All services started. Tailing logs to keep the container running.");
                } else {
                    // Container exited, check it was successful
                    expect(result.exitCode).toBe(0);
                }
            } catch (error: unknown) {
                const execaError = error as {
                    exitCode?: number;
                    all?: string;
                    stderr?: string;
                    stdout?: string;
                    message?: string;
                };
                console.log("Exit code:", execaError.exitCode);
                console.log("\n--- Full error output ---");
                console.log(execaError.all || execaError.stderr || execaError.stdout || execaError.message);
                console.log("--- End error output ---\n");

                // Re-throw to fail the test
                throw error;
            } finally {
                // Clean up diagnostic container
                await removeContainer(`${RESTRICTED_CONTAINER_NAME}-diagnostic`);
            }
        });
    });
});
