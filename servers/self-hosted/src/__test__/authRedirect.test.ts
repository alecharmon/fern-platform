/**
 * E2E test for auth redirect URLs in self-hosted mode.
 *
 * Starts a separate Docker container with basic_token_verification auth configured
 * and verifies that the redirect_uri in auth redirects uses the external domain
 * (not the internal localhost:3001 Next.js address).
 *
 * This mirrors the smoke-test deployment pattern (which uses password auth)
 * but specifically tests the basic_token_verification redirect flow.
 */
import { execa } from "execa";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FERN_NETWORK_NAME, SELF_HOSTED_IMAGE_TAG_NAME } from "./setupSharedDocker";
import { testAuthRedirectUsesExternalDomain, waitForDocsReady } from "./testHelpers";

const AUTH_CONTAINER_NAME = "fern-self-hosted-auth-test";
const FERN_DIR = path.join(__dirname, "../../fern");

// The domain derived from the test fern project's docs.yml custom-domain
const EXPECTED_DOMAIN = "plantstore.dev";

let containerId: string | undefined;

async function removeContainer(name: string) {
    try {
        await execa("docker", ["rm", "-f", name]);
    } catch (_) {}
}

beforeAll(async () => {
    await removeContainer(AUTH_CONTAINER_NAME);

    // Start a container with basic_token_verification auth enabled.
    // FERN_AUTH_REDIRECT points to a dummy URL; the test only inspects the redirect_uri
    // parameter that the middleware appends, not the actual auth provider.
    const { stdout: id } = await execa("docker", [
        "run",
        "--name",
        AUTH_CONTAINER_NAME,
        "-d",
        "--network",
        FERN_NETWORK_NAME,
        "-e",
        "FERN_AUTH_TYPE=basic_token_verification",
        "-e",
        "FERN_AUTH_SECRET=test-secret-for-e2e",
        "-e",
        "FERN_AUTH_REDIRECT=https://auth.example.com/login",
        "-e",
        "FERN_AUTH_ISSUER=https://auth.example.com",
        "-e",
        "WARMUP=false",
        "-v",
        `${FERN_DIR}:/fern`,
        "--tmpfs",
        "/data:rw,size=1g,mode=0777",
        SELF_HOSTED_IMAGE_TAG_NAME
    ]);

    containerId = id.trim();
    console.log("Auth test container started:", containerId);

    // Wait for the container to be ready (services need time to initialize)
    console.log("Waiting for docs to become ready...");
    await waitForDocsReady(containerId);
    console.log("Docs are ready");
}, 300000); // 5 minutes for container startup

afterAll(async () => {
    if (containerId) {
        try {
            const { stdout: logs } = await execa("docker", ["logs", "--tail", "50", containerId], {
                reject: false
            });
            console.log("Auth container final logs:\n", logs);
        } catch (_) {}
    }
    await removeContainer(AUTH_CONTAINER_NAME);
}, 30000);

describe("Auth redirect e2e with basic_token_verification", () => {
    it("redirect_uri should use the external domain, not localhost", async () => {
        expect(containerId).toBeTruthy();
        await testAuthRedirectUsesExternalDomain(containerId!, EXPECTED_DOMAIN);
    }, 60000);

    it("redirect_uri should contain the JWT callback path", async () => {
        expect(containerId).toBeTruthy();

        // Capture the redirect response
        const { stdout: response } = await execa("docker", [
            "exec",
            containerId!,
            "curl",
            "-s",
            "-D",
            "-",
            "-o",
            "/dev/null",
            "http://localhost:3000"
        ]);

        const locationMatch = response.match(/[Ll]ocation:\s*(.+)/);
        expect(locationMatch).toBeTruthy();

        const locationUrl = locationMatch![1]!.trim();
        const fullyDecoded = decodeURIComponent(decodeURIComponent(locationUrl));

        // The redirect_uri should point to the JWT callback endpoint
        expect(fullyDecoded).toContain("/api/fern-docs/auth/jwt/callback");
    }, 60000);

    it("redirect should go to the configured FERN_AUTH_REDIRECT URL", async () => {
        expect(containerId).toBeTruthy();

        // Capture the redirect response
        const { stdout: response } = await execa("docker", [
            "exec",
            containerId!,
            "curl",
            "-s",
            "-D",
            "-",
            "-o",
            "/dev/null",
            "http://localhost:3000"
        ]);

        const locationMatch = response.match(/[Ll]ocation:\s*(.+)/);
        expect(locationMatch).toBeTruthy();

        const locationUrl = locationMatch![1]!.trim();

        // The Location header should redirect to our configured auth redirect URL
        expect(locationUrl).toContain("auth.example.com");
    }, 60000);
});
