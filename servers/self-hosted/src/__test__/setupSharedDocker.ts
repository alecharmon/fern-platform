import { execa } from "execa";

export const SELF_HOSTED_IMAGE_NAME = "fern-self-hosted";
export const SELF_HOSTED_TAG = "latest";
export const SELF_HOSTED_IMAGE_TAG_NAME = `${SELF_HOSTED_IMAGE_NAME}:${SELF_HOSTED_TAG}`;
export const FERN_NETWORK_NAME = "fern-network";

async function removeImage(imageName: string) {
    try {
        await execa("docker", ["rmi", "-f", imageName]);
    } catch (_) {}
}

async function createNetwork(networkName: string) {
    try {
        // Check if network already exists
        const { stdout } = await execa("docker", [
            "network",
            "ls",
            "--filter",
            `name=^${networkName}$`,
            "--format",
            "{{.Name}}"
        ]);
        if (stdout.trim() === networkName) {
            console.log(`Network ${networkName} already exists`);
            return;
        }

        // Create internal network that blocks external access
        await execa("docker", ["network", "create", "--internal", networkName]);
        console.log(`Network ${networkName} created`);
    } catch (error) {
        console.error(`Failed to create network ${networkName}:`, error);
        throw error;
    }
}

async function removeNetwork(networkName: string) {
    try {
        await execa("docker", ["network", "rm", networkName]);
        console.log(`Network ${networkName} removed`);
    } catch (_) {
        // Network might not exist or might be in use, ignore errors
    }
}

export async function setup() {
    // Build the Docker image once for all tests
    console.log("Building Docker image for tests...");
    await execa("pnpm", ["docker:build"], { stdio: "inherit" });
    console.log("Docker image built successfully");

    // Create the fern-network for all tests
    console.log("Creating fern-network...");
    await createNetwork(FERN_NETWORK_NAME);
    console.log("fern-network created successfully");
}

export async function teardown() {
    // Clean up the Docker image once after all tests
    try {
        console.log("Cleaning up Docker image...");
        await removeImage(SELF_HOSTED_IMAGE_TAG_NAME);
        console.log("Docker image cleanup complete");

        // Clean up the network
        console.log("Cleaning up fern-network...");
        await removeNetwork(FERN_NETWORK_NAME);
        console.log("fern-network cleanup complete");
    } catch (error) {
        console.error("Failed to cleanup Docker resources:", error);
        throw error;
    }
}
