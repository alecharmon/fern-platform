import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";

export type FernBotOctokitError =
  | { type: "MISSING_APP_ID" }
  | { type: "MISSING_PRIVATE_KEY" }
  | { type: "NOT_INSTALLED"; owner: string; repo: string }
  | { type: "UNKNOWN_ERROR"; message: string };

export type GetFernBotOctokitForRepoResult =
  | { ok: true; octokit: Octokit }
  | { ok: false; error: FernBotOctokitError };

export type GetFernBotInstallationIdResult =
  | { ok: true; installationId: number }
  | { ok: false; error: FernBotOctokitError };

/**
 * Gets Octokit for a specific repo where fern-bot is installed. This should then
 * deprecate the use of the `octokit.ts` file.
 *
 * @param owner - The owner of the repository
 * @param repo - The name of the repository
 * @returns A discriminated union result with the Octokit instance or an error
 */
export async function getFernBotOctokitForRepo(
  owner: string,
  repo: string
): Promise<GetFernBotOctokitForRepoResult> {
  const appId = process.env.FERN_BOT_APP_ID;
  const privateKey = process.env.FERN_BOT_PRIVATE_KEY;

  if (!appId) {
    return { ok: false, error: { type: "MISSING_APP_ID" } };
  }
  if (!privateKey) {
    return { ok: false, error: { type: "MISSING_PRIVATE_KEY" } };
  }

  const installationIdResult = await getFernBotInstallationId(owner, repo);
  if (!installationIdResult.ok) {
    return { ok: false, error: installationIdResult.error };
  }

  try {
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey: formatPrivateKey(privateKey),
        installationId: installationIdResult.installationId,
      },
    });
    return { ok: true, octokit };
  } catch (e: any) {
    return {
      ok: false,
      error: { type: "UNKNOWN_ERROR", message: e?.message ?? "Unknown error" },
    };
  }
}

/**
 * Gets the installation id for the fern-bot for a given owner and repo
 * or returns an error result if it does not exist or on failure.
 *
 * @param owner - The owner of the repository
 * @param repo - The name of the repository
 * @returns A discriminated union result with the installation id or an error
 */
export async function getFernBotInstallationId(
  owner: string,
  repo: string
): Promise<GetFernBotInstallationIdResult> {
  const appId = process.env.FERN_BOT_APP_ID;
  const privateKeyEnv = process.env.FERN_BOT_PRIVATE_KEY;

  if (!appId) {
    return { ok: false, error: { type: "MISSING_APP_ID" } };
  }
  if (!privateKeyEnv) {
    return { ok: false, error: { type: "MISSING_PRIVATE_KEY" } };
  }

  const privateKey = formatPrivateKey(privateKeyEnv);

  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
    },
  });

  try {
    const response = await appOctokit.request(
      "GET /repos/{owner}/{repo}/installation",
      {
        owner,
        repo,
      }
    );
    const installation = response.data;
    return { ok: true, installationId: installation.id };
  } catch (error: any) {
    if (error?.status === 404) {
      // fern-bot is not yet installed on that repo
      return {
        ok: false,
        error: { type: "NOT_INSTALLED", owner, repo },
      };
    } else {
      return {
        ok: false,
        error: {
          type: "UNKNOWN_ERROR",
          message: error?.message ?? "Unknown error",
        },
      };
    }
  }
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
