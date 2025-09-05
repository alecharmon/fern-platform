import { Auth0OrgName } from "../auth0/types";
import { DashboardApiClient } from "../dashboard-api/client";

export const DEFAULT_PR_TITLE = "Visual Editor: Update";
export const DEFAULT_COMMIT_MESSAGE = "Visual Editor: Update";

export async function handleCreatePr({
  orgName,
  branch,
  owner,
  site,
  repo,
  baseBranch,
  title,
  onAiGenerationComplete,
}: {
  orgName: Auth0OrgName;
  branch: string;
  owner: string;
  site: string;
  repo: string;
  baseBranch: string;
  title?: string;
  onAiGenerationComplete?: () => void;
}): Promise<string | undefined> {
  try {
    const response = await DashboardApiClient.postCreatePr({
      orgName,
      owner,
      repo,
      site,
      head: branch,
      base: baseBranch,
      title: title || DEFAULT_PR_TITLE,
      draft: true,
    });
    if (response.success) {
      try {
        // No need to await this, we just want to try to generate a PR description.
        void handleGeneratePrDescription({
          orgName,
          branch,
          owner,
          site,
          repo,
          baseBranch,
        }).then((result) => {
          if (result.success && onAiGenerationComplete) {
            onAiGenerationComplete();
          }
        });
      } catch (error) {
        // Silently fail if we can't generate a PR description.
        console.error("Error generating PR description:", error);
      }
      return response.prUrl;
    } else {
      console.error("Failed to create PR:", response.error);
    }
  } catch (error) {
    console.error("Error creating PR:", error);
  }
  return undefined;
}

export async function handleGeneratePrDescription({
  orgName,
  branch,
  owner,
  site,
  repo,
  baseBranch,
}: {
  orgName: Auth0OrgName;
  branch: string;
  owner: string;
  site: string;
  repo: string;
  baseBranch: string;
}): Promise<{
  success: boolean;
  error?: string;
  newTitle?: string;
}> {
  return await DashboardApiClient.generatePrDescription({
    orgName,
    owner,
    site,
    repo,
    branch,
    baseBranch,
  });
}

export function getOwnerAndRepoFromGithubUrl(githubUrl: string) {
  const [owner, repo] = githubUrl.split("/").slice(-2);
  return { owner, repo };
}

export function getRepoDisplayNameFromUrl(githubUrl: string) {
  const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
  return `${owner}/${repo}`;
}

export function validateUrlIsGithubUrl(inputUrl: string): boolean {
  // Check if URL starts with http/https
  if (!inputUrl.startsWith("https://") && !inputUrl.startsWith("http://")) {
    return false;
  }

  try {
    const url = new URL(inputUrl);
    // Check if domain is github.com
    if (url.hostname !== "github.com") {
      return false;
    }

    // Check if path has at least 2 segments (username/repo)
    const pathSegments = url.pathname
      .split("/")
      .filter((segment) => segment.length > 0);
    if (pathSegments.length < 2) {
      return false;
    }

    return true;
  } catch {
    // If URL parsing fails, it's not a valid GitHub URL
    return false;
  }
}
