import { getOwnerAndRepoFromGithubUrl } from "../../github/github";
import type { RepoData, RepoIdentifier } from "./types";

export async function deriveRepoIdentifier({
  githubUrl,
  owner,
  repo,
}: {
  githubUrl?: string;
  owner?: string;
  repo?: string;
}): Promise<
  { success: true; identifier: RepoIdentifier } | { success: false }
> {
  if (githubUrl) {
    return { success: true, identifier: { type: "url", githubUrl } };
  } else if (owner && repo) {
    return { success: true, identifier: { type: "owner-repo", owner, repo } };
  }
  return { success: false };
}

/**
 * Normalizes extracted repo data into a complete RepoData object
 */
export function normalizeRepoData(identifier: RepoIdentifier): RepoData {
  if (identifier.type === "url") {
    const { owner, repo } = getOwnerAndRepoFromGithubUrl(identifier.githubUrl);
    return {
      owner: owner || "",
      repo: repo || "",
      githubUrl: identifier.githubUrl,
    };
  }
  return {
    owner: identifier.owner,
    repo: identifier.repo,
    githubUrl: `https://github.com/${identifier.owner}/${identifier.repo}`,
  };
}
