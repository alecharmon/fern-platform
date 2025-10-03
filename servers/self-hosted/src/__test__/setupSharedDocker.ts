import { execa } from "execa";

export const SELF_HOSTED_IMAGE_NAME = "fern-self-hosted";
export const SELF_HOSTED_TAG = "latest";
export const SELF_HOSTED_IMAGE_TAG_NAME = `${SELF_HOSTED_IMAGE_NAME}:${SELF_HOSTED_TAG}`;

async function removeImage(imageName: string) {
    try {
        await execa("docker", ["rmi", "-f", imageName]);
    } catch (_) {}
}

export async function setup() {
    // Build the Docker image once for all tests
    console.log("Building Docker image for tests...");
    await execa("pnpm", ["docker:build"], { stdio: "inherit" });
    console.log("Docker image built successfully");
}

export async function teardown() {
    // Clean up the Docker image once after all tests
    try {
        console.log("Cleaning up Docker image...");
        await removeImage(SELF_HOSTED_IMAGE_TAG_NAME);
        console.log("Docker image cleanup complete");
    } catch (error) {
        console.error("Failed to cleanup Docker image:", error);
        throw error;
    }
}
