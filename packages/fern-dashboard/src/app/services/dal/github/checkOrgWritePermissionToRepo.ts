import "server-only";

import { Octokit } from "@octokit/core";
import z from "zod";

import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";

export type CheckOrgWritePermissionToRepoError =
  | { type: "MALFORMED_GITHUB_URL"; url: string }
  | { type: "FERN_BOT_NOT_INSTALLED" }
  | { type: "FERN_CONFIG_JSON_ORG_MISMATCH" }
  | FernConfigJsonError;

export type CheckOrgWritePermissionToRepoResult =
  | { ok: true }
  | { ok: false; error: CheckOrgWritePermissionToRepoError };

/**
 * Checks if the user has write permission to a given GitHub repository.
 *
 * @param userId - The ID of the user to check
 * @param githubUrl - The URL of the GitHub repository to check
 * @returns true if the user has write permission, false otherwise
 */
export async function checkOrgWritePermissionToRepo(
  orgName: string,
  githubUrl: string
): Promise<CheckOrgWritePermissionToRepoResult> {
  const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
  if (owner == null || repo == null) {
    return {
      ok: false,
      error: { type: "MALFORMED_GITHUB_URL", url: githubUrl },
    };
  }

  // Use Fern bot to check permissions
  const fernBotResult = await getFernBotOctokitForRepo(owner, repo);
  if (!fernBotResult.ok) {
    if (fernBotResult.error.type === "NOT_INSTALLED") {
      return {
        ok: false,
        error: { type: "FERN_BOT_NOT_INSTALLED" },
      };
    }

    // For other errors, let's treat it as an internal server error for now
    throw new Error(
      `Internal server error while checking Fern bot installation or permissions: ${JSON.stringify(
        fernBotResult.error
      )}`
    );
  }

  const fernBotOctokit = fernBotResult.octokit;

  // Use the helper function to fetch fern.config.json from the repo
  const fernConfigResult = await getFernConfigJsonFromRepo(
    fernBotOctokit,
    owner,
    repo
  );

  if (!fernConfigResult.ok) {
    return {
      ok: false,
      error: fernConfigResult.error,
    };
  }

  const fernConfigJson = fernConfigResult.config;

  if (fernConfigJson.organization !== orgName) {
    return {
      ok: false,
      error: { type: "FERN_CONFIG_JSON_ORG_MISMATCH" },
    };
  }

  return { ok: true };
}

// Helpers

type FernConfigJsonError =
  | { type: "FERN_CONFIG_JSON_MISSING" }
  | { type: "FERN_CONFIG_JSON_MALFORMED" };

type GetFernConfigJsonResult =
  | { ok: true; config: z.infer<typeof fernConfigSchema> }
  | { ok: false; error: FernConfigJsonError };

async function getFernConfigJsonFromRepo(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<GetFernConfigJsonResult> {
  let fernConfigJson: unknown;
  try {
    const fernConfigResponse = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner,
        repo,
        path: "fern/fern.config.json",
      }
    );

    // Confirm the response is a file and has content
    if (
      !fernConfigResponse.data ||
      Array.isArray(fernConfigResponse.data) ||
      fernConfigResponse.data.type !== "file" ||
      typeof fernConfigResponse.data.content !== "string"
    ) {
      return {
        ok: false,
        error: { type: "FERN_CONFIG_JSON_MALFORMED" },
      };
    }

    // The content is base64 encoded
    let decodedContent: string;
    try {
      decodedContent = Buffer.from(
        fernConfigResponse.data.content,
        "base64"
      ).toString("utf-8");
    } catch (e) {
      throw new Error(
        `Failed to decode base64 content of fern/fern.config.json in ${owner}/${repo}: ${(e as Error).message}`
      );
    }

    try {
      fernConfigJson = JSON.parse(decodedContent);
    } catch (_e) {
      return {
        ok: false,
        error: { type: "FERN_CONFIG_JSON_MALFORMED" },
      };
    }
  } catch (error: any) {
    if (error?.status === 404) {
      return {
        ok: false,
        error: { type: "FERN_CONFIG_JSON_MISSING" },
      };
    }
    throw new Error(
      `Failed to fetch fern.config.json: ${error?.message ?? "Unknown error"}`
    );
  }

  const parseResult = fernConfigSchema.safeParse(fernConfigJson);
  if (!parseResult.success) {
    return {
      ok: false,
      error: { type: "FERN_CONFIG_JSON_MALFORMED" },
    };
  }

  return { ok: true, config: parseResult.data };
}

const fernConfigSchema = z.object({
  organization: z.string(),
});
