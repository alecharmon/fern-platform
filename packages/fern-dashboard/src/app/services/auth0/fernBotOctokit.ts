import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";

/**
 * Gets Octokit for a specific repo where fern-bot is installed. This should then
 * deprecate the use of the `octokit.ts` file.
 *
 * @param owner - The owner of the repository
 * @param repo - The name of the repository
 * @returns The Octokit instance for the fern-bot installation
 * @throws Error if no fern-bot is installed on that repo
 * @throws Error if FERN_BOT_APP_ID or FERN_BOT_PRIVATE_KEY are not defined or defined incorrectly
 */
export async function getFernBotOctokitForRepo(owner: string, repo: string) {
  const appId = process.env.FERN_BOT_APP_ID;
  const privateKey = process.env.FERN_BOT_PRIVATE_KEY;

  if (!appId) {
    throw new Error("FERN_BOT_APP_ID environment variable is missing");
  }
  if (!privateKey) {
    throw new Error("FERN_BOT_PRIVATE_KEY environment variable is missing");
  }

  const installationId = await getFernBotInstallationId(owner, repo);
  if (!installationId) {
    throw new Error(
      `No fern-bot installation found for repo ${owner}/${repo}. Please ensure the app is installed on this repository.`
    );
  }

  // installation-specific Octokit
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.FERN_BOT_APP_ID,
      privateKey: formatPrivateKey(privateKey),
      installationId: installationId,
    },
  });
}

/**
 * Gets the installation id for the fern-bot for a given owner and repo
 * or returns undefined if it does not exist.
 *
 * @param owner - The owner of the repository
 * @param repo - The name of the repository
 * @returns string installation id, or undefined if no such id exists
 * @throws Error if FERN_BOT_APP_ID or FERN_BOT_PRIVATE_KEY are not defined or defined incorrectly
 */
export async function getFernBotInstallationId(owner: string, repo: string) {
  const appId = process.env.FERN_BOT_APP_ID;
  const privateKeyEnv = process.env.FERN_BOT_PRIVATE_KEY;

  if (!appId) {
    throw new Error("FERN_BOT_APP_ID environment variable is missing");
  }
  if (!privateKeyEnv) {
    throw new Error("FERN_BOT_PRIVATE_KEY environment variable is missing");
  }

  const privateKey = formatPrivateKey(privateKeyEnv);

  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
    },
  });

  let installation;
  try {
    const response = await appOctokit.request(
      "GET /repos/{owner}/{repo}/installation",
      {
        owner,
        repo,
      }
    );
    installation = response.data;
  } catch (error: any) {
    if (error.status === 404) {
      // fern-bot is not yet installed on that repo
      return undefined;
    } else {
      return undefined;
    }
  }

  return installation.id;
}

function formatPrivateKey(privateKey: string) {
  // Convert any escaped newlines to actual newlines
  const formattedPrivateKey = privateKey
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "-----BEGIN PRIVATE KEY-----\n")
    .replace(/-----END PRIVATE KEY-----/, "\n-----END PRIVATE KEY-----")
    .trim();

  return formattedPrivateKey;
}
