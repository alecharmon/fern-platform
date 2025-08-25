import { getFernBotOctokitForRepo } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export default async function postCreatePr(request: {
  owner: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body?: string;
  draft?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  prUrl?: string;
  prNumber?: number;
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
    // Create the pull request
    const response = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
      owner: request.owner,
      repo: request.repo,
      head: request.head,
      base: request.base,
      title: request.title,
      body: request.body,
      draft: request.draft || false,
    });

    return {
      success: true,
      prUrl: response.data.html_url,
      prNumber: response.data.number,
      response,
    };
  } catch (error) {
    console.error("Failed to create pull request", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
