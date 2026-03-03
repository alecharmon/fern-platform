"use server";

import fs from "node:fs/promises";
import path from "node:path";
import _sodium from "libsodium-wrappers";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

export type SetFernTokenSecretResult =
    | { success: true; token: string }
    | {
          success: false;
          error: {
              type: "MISSING_BOT_TOKEN" | "TOKEN_GENERATION_FAILED" | "SECRET_SET_FAILED";
              message: string;
          };
      };

const DEFAULT_MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [8000, 20000];

/**
 * Helper function to delay execution
 */
async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a FERN_TOKEN and sets it as a GitHub Actions secret in the repository.
 * Includes retry logic with 8s and 20s delays for transient failures.
 *
 * @param owner - The repository owner (username or organization)
 * @param repoName - The repository name
 * @param workingDir - The working directory containing fern/fern.config.json (used to read the organization name)
 * @param fernToken - Optional FERN_TOKEN to use for authentication. If not provided, uses process.env
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns Result indicating success or failure with the generated token
 */
export async function setFernTokenSecret(params: {
    owner: string;
    repoName: string;
    workingDir: string;
    fernToken?: string;
    maxRetries?: number;
}): Promise<SetFernTokenSecretResult> {
    const { owner, repoName, workingDir, fernToken, maxRetries = DEFAULT_MAX_RETRIES } = params;

    let lastError: SetFernTokenSecretResult | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await attemptSetFernTokenSecret({
            owner,
            repoName,
            workingDir,
            fernToken
        });

        if (result.success) {
            return result;
        }

        lastError = result;

        if (result.error.type === "MISSING_BOT_TOKEN") {
            return result;
        }

        if (attempt < maxRetries) {
            const delayIndex = Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1);
            const delayMs = RETRY_DELAYS_MS[delayIndex] as number;
            console.log(`[setFernTokenSecret] Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
            await delay(delayMs);
        }
    }

    console.error(`[setFernTokenSecret] All ${maxRetries} attempts failed`);
    return (
        lastError ?? {
            success: false,
            error: {
                type: "SECRET_SET_FAILED",
                message: "All retry attempts failed"
            }
        }
    );
}

/**
 * Single attempt to set the FERN_TOKEN secret
 */
async function attemptSetFernTokenSecret(params: {
    owner: string;
    repoName: string;
    workingDir: string;
    fernToken?: string;
}): Promise<SetFernTokenSecretResult> {
    const { owner, repoName, workingDir, fernToken } = params;

    try {
        const octokitResult = getDemoCreationBotOctokit();
        if (!octokitResult.ok) {
            return {
                success: false,
                error: {
                    type: "MISSING_BOT_TOKEN",
                    message: "Failed to get demo creation bot token"
                }
            };
        }

        const octokit = octokitResult.octokit;

        console.log("Generating FERN_TOKEN via Venus API...");

        // Read the org name from fern.config.json in the working directory
        const configPath = path.join(workingDir, "fern", "fern.config.json");
        const configContent = await fs.readFile(configPath, "utf-8");
        const config = JSON.parse(configContent) as { organization: string };
        const orgId = config.organization;

        const venusClient = getVenusClient({
            token: fernToken ?? process.env.FERN_TOKEN ?? ""
        });
        const response = await venusClient.registry.generateRegistryTokens({
            organizationId: orgId
        });

        if (!response.ok) {
            return {
                success: false,
                error: {
                    type: "TOKEN_GENERATION_FAILED",
                    message: `Failed to generate token via Venus API: ${JSON.stringify(response.error)}`
                }
            };
        }

        const generatedToken = response.body.npm.token;
        console.log("Generated FERN_TOKEN via Venus API");

        await _sodium.ready;
        const sodium = _sodium;

        const { data: publicKeyData } = await octokit.request("GET /repos/{owner}/{repo}/actions/secrets/public-key", {
            owner,
            repo: repoName
        });

        const messageBytes = sodium.from_string(generatedToken);
        const keyBytes = new Uint8Array(Buffer.from(publicKeyData.key, "base64"));
        const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
        const encryptedValue = Buffer.from(encryptedBytes).toString("base64");

        await octokit.request("PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}", {
            owner,
            repo: repoName,
            secret_name: "FERN_TOKEN",
            encrypted_value: encryptedValue,
            key_id: publicKeyData.key_id
        });

        console.log(`Set FERN_TOKEN secret for ${owner}/${repoName}`);

        return {
            success: true,
            token: generatedToken
        };
    } catch (error) {
        console.error("Failed to set FERN_TOKEN secret:", error);
        return {
            success: false,
            error: {
                type: "SECRET_SET_FAILED",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            }
        };
    }
}
