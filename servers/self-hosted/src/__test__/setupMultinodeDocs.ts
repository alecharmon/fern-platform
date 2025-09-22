import { execa } from "execa";
import path from "path";

export const MULTINODE_COMPOSE_FILE = "docker-compose.multinode.yml";
export const MULTINODE_PROJECT_NAME = "fern-self-hosted-multinode";
export const MULTINODE_INSTANCES = [
  "fern-self-hosted-1",
  "fern-self-hosted-2",
  "fern-self-hosted-3",
];

// we have a fern folder we use for testing
const FERN_DIR = path.join(__dirname, "../../fern");

async function stopComposeServices(projectName: string) {
  try {
    await execa("docker", [
      "compose",
      "-f",
      MULTINODE_COMPOSE_FILE,
      "-p",
      projectName,
      "down",
      "-v",
    ]);
  } catch (_) {}
}

async function removeComposeVolumes(projectName: string) {
  try {
    await execa("docker", ["volume", "prune", "-f"]);
  } catch (_) {}
}

export async function setup() {
  // Clean up any existing services
  await stopComposeServices(MULTINODE_PROJECT_NAME);
  await removeComposeVolumes(MULTINODE_PROJECT_NAME);

  // Start the multi-node services using the shared image
  await execa(
    "docker",
    [
      "compose",
      "-f",
      MULTINODE_COMPOSE_FILE,
      "-p",
      MULTINODE_PROJECT_NAME,
      "up",
      "-d",
    ],
    { stdio: "inherit" }
  );

  // Wait for services to be ready
  await sleep(15000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function teardown() {
  try {
    console.log("Stopping multi-node services...");
    await stopComposeServices(MULTINODE_PROJECT_NAME);
    await removeComposeVolumes(MULTINODE_PROJECT_NAME);
    console.log("Multi-node cleanup complete");
  } catch (error) {
    console.error("Failed to cleanup multi-node services:", error);
    throw error;
  }
}
