import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { GithubCommitableFile } from "@/app/services/github/types";

export default async function postGitCommit(
  userId: Auth0UserID,
  orgName: Auth0OrgName,
  request: {
    owner: string;
    repo: string;
    branch: string;
    message: string;
    files: GithubCommitableFile[];
  }
): Promise<{
  success: boolean;
  error?: string;
  commitSha?: string;
}> {
  const session = await getCurrentSession();
  if (session == null) {
    return { success: false, error: "No session found" };
  }

  const octokit = await getOctokit(userId, orgName);

  if (octokit == null) {
    return { success: false, error: "Failed to get GitHub client" };
  }

  try {
    // Get the current tree SHA for the branch
    const {
      data: {
        object: { sha: baseSha },
      },
    } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner: request.owner,
      repo: request.repo,
      ref: `heads/${request.branch}`,
    });

    // Get the current commit to get the tree SHA
    const {
      data: {
        tree: { sha: baseTreeSha },
      },
    } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
      {
        owner: request.owner,
        repo: request.repo,
        commit_sha: baseSha,
      }
    );

    // Create a new tree with the files
    const tree = request.files.map((file) => ({
      path: file.path,
      mode: file.mode || "100644",
      type: "blob" as const,
      content: file.content,
    }));

    const {
      data: { sha: newTreeSha },
    } = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
      owner: request.owner,
      repo: request.repo,
      base_tree: baseTreeSha,
      tree,
    });

    // Create a new commit
    const {
      data: { sha: commitSha },
    } = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
      owner: request.owner,
      repo: request.repo,
      message: request.message,
      tree: newTreeSha,
      parents: [baseSha],
    });

    // Update the branch reference to point to the new commit
    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: request.owner,
      repo: request.repo,
      ref: `heads/${request.branch}`,
      sha: commitSha,
    });

    return {
      success: true,
      commitSha,
    };
  } catch (error) {
    console.error("Failed to commit changes", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
