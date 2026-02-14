"use server";

import { spawn } from "node:child_process";
import _sodium from "libsodium-wrappers";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { fernCliConfig } from "@/utils/fernCliConfig";

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
 * @param workingDir - The working directory where the fern project exists (for running `fern token`)
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
        const result = await attemptSetFernTokenSecret({ owner, repoName, workingDir, fernToken });

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

        console.log("Generating FERN_TOKEN...");

        const env = {
            ...process.env,
            ...(fernToken && { FERN_TOKEN: fernToken }),
            npm_config_cache: "/tmp/.npm",
            NPM_CONFIG_CACHE: "/tmp/.npm"
        };

        const tokenProcess = spawn("npx", [fernCliConfig.npmPackage, "token"], {
            cwd: workingDir,
            env
        });

        let tokenOutput = "";
        tokenProcess.stdout.on("data", (data) => {
            tokenOutput += data.toString();
        });
        tokenProcess.stderr.on("data", (data) => {
            tokenOutput += data.toString();
        });

        await new Promise<void>((resolve, reject) => {
            tokenProcess.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    const cleanOutput = tokenOutput.replace(/\x1b\[[0-9;]*m/g, "").trim();
                    reject(new Error(`fern token exited with code ${code}. Output: ${cleanOutput.substring(0, 500)}`));
                }
            });
            tokenProcess.on("error", reject);
            setTimeout(() => {
                tokenProcess.kill();
                reject(new Error("Token generation timeout"));
            }, 30000);
        });

        const cleanOutput = tokenOutput.replace(/\x1b\[[0-9;]*m/g, "");
        const tokenMatch = cleanOutput.match(/fern_[a-zA-Z0-9_-]+/);
        if (!tokenMatch) {
            return {
                success: false,
                error: {
                    type: "TOKEN_GENERATION_FAILED",
                    message: `Failed to parse FERN_TOKEN from output. Output was: ${cleanOutput.substring(0, 200)}`
                }
            };
        }
        const generatedToken = tokenMatch[0].trim();
        console.log("Generated FERN_TOKEN");

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
