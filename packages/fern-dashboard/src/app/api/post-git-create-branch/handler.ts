import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export default async function postCreateBranch(request: {
  owner: string;
  repo: string;
  branch: string;
  baseBranch: string;
}): Promise<{
  success: boolean;
  error?: string;
  baseSha?: string;
  response?: any;
}> {
  const session = await getCurrentSession();
  if (session == null) {
    return { success: false, error: "No session found" };
  }

  const octokitResult = await getFernBotOctokitForRepo(
    request.owner,
    request.repo
  );

  if (!octokitResult.ok) {
    throw new Error(`Failed to get GitHub client: ${octokitResult.error.type}`);
  }

  const octokit = octokitResult.octokit;

  try {
    // Get the latest commit SHA on base branch
    const {
      data: {
        object: { sha: baseSha },
      },
    } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner: request.owner,
      repo: request.repo,
      ref: `heads/${request.baseBranch}`,
    });

    // Create the new branch
    const response = await octokit.request(
      "POST /repos/{owner}/{repo}/git/refs",
      {
        owner: request.owner,
        repo: request.repo,
        ref: `refs/heads/${request.branch}`,
        sha: baseSha,
      }
    );

    return {
      success: true,
      baseSha,
      response,
    };
  } catch (error) {
    return {
      success: false,
      error: `Unknown error occurred: ${error}`, // TODO: Add error message
    };
  }
}
