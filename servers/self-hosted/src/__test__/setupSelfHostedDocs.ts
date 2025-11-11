import { execa } from "execa";
import path from "path";

import { FERN_NETWORK_NAME, SELF_HOSTED_IMAGE_TAG_NAME } from "./setupSharedDocker";

export const SELF_HOSTED_CONTAINER_NAME = "fern-self-hosted";
const SELF_HOSTED_CONTAINER_PORT = 5433;

// we have a fern folder we use for testing
const FERN_DIR = path.join(__dirname, "../../fern");

async function stopContainer(containerName: string) {
    try {
        await execa("docker", ["stop", "-t", "10", containerName]);
    } catch (_) {}
}

async function removeContainer(containerName: string) {
    try {
        await execa("docker", ["rm", "-f", containerName]);
    } catch (_) {}
}

export async function setup() {
    // Remove any existing container
    await removeContainer(SELF_HOSTED_CONTAINER_NAME);

    // Start the container using the shared image with fern-network
    await execa("docker", [
        "run",
        "--name",
        SELF_HOSTED_CONTAINER_NAME,
        "-d",
        "--network",
        FERN_NETWORK_NAME,
        "-p",
        `${SELF_HOSTED_CONTAINER_PORT}:5432`,
        "-p",
        "8080:8080",
        "-p",
        "8081:8081",
        "-p",
        "9000:9000",
        "-p",
        "3000:3000",
        "-v",
        `${FERN_DIR}:/fern`,
        SELF_HOSTED_IMAGE_TAG_NAME
    ]);
    await sleep(10000);
}

export async function teardown() {
    // Clean up single-node container after tests
    try {
        console.log("Cleaning up single-node container...");
        await stopContainer(SELF_HOSTED_CONTAINER_NAME);
        await removeContainer(SELF_HOSTED_CONTAINER_NAME);
        console.log("Single-node cleanup complete");
    } catch (error) {
        console.error("Failed to cleanup single-node container:", error);
        throw error;
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
