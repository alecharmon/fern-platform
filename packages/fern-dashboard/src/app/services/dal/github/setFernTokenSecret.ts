"use server";

import { spawn } from "node:child_process";
import _sodium from "libsodium-wrappers";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";

export type SetFernTokenSecretResult =
    | { success: true; token: string }
    | {
          success: false;
          error: {
              type: "MISSING_BOT_TOKEN" | "TOKEN_GENERATION_FAILED" | "SECRET_SET_FAILED";
              message: string;
          };
      };

/**
 * Generates a FERN_TOKEN and sets it as a GitHub Actions secret in the repository.
 *
 * @param owner - The repository owner (username or organization)
 * @param repoName - The repository name
 * @param workingDir - The working directory where the fern project exists (for running `fern token`)
 * @param fernToken - Optional FERN_TOKEN to use for authentication. If not provided, uses process.env
 * @returns Result indicating success or failure with the generated token
 */
export async function setFernTokenSecret(params: {
    owner: string;
    repoName: string;
    workingDir: string;
    fernToken?: string;
}): Promise<SetFernTokenSecretResult> {
    const { owner, repoName, workingDir, fernToken } = params;

    try {
        // Get the demo creation bot octokit
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

        // Generate FERN_TOKEN by running `fern token` command
        console.log("Generating FERN_TOKEN...");

        const env = {
            ...process.env,
            ...(fernToken && { FERN_TOKEN: fernToken }),
            npm_config_cache: "/tmp/.npm",
            NPM_CONFIG_CACHE: "/tmp/.npm"
        };

        const tokenProcess = spawn("npx", ["fern-api", "token"], {
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
                    reject(new Error(`fern token exited with code ${code}`));
                }
            });
            tokenProcess.on("error", reject);
            setTimeout(() => {
                tokenProcess.kill();
                reject(new Error("Token generation timeout"));
            }, 30000);
        });

        // Parse token from output (format: "Generated a FERN_TOKEN for X: fern_...")
        // Strip ANSI escape codes
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
        console.log("✓ Generated FERN_TOKEN");

        // Get the repo's public key for encrypting secrets
        await _sodium.ready;
        const sodium = _sodium;

        const { data: publicKeyData } = await octokit.request("GET /repos/{owner}/{repo}/actions/secrets/public-key", {
            owner,
            repo: repoName
        });

        // Encrypt the token using libsodium's sealed box
        const messageBytes = sodium.from_string(generatedToken);
        const keyBytes = new Uint8Array(Buffer.from(publicKeyData.key, "base64"));
        const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes);
        const encryptedValue = Buffer.from(encryptedBytes).toString("base64");

        // Set the secret
        await octokit.request("PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}", {
            owner,
            repo: repoName,
            secret_name: "FERN_TOKEN",
            encrypted_value: encryptedValue,
            key_id: publicKeyData.key_id
        });

        console.log(`✓ Set FERN_TOKEN secret for ${owner}/${repoName}`);

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
