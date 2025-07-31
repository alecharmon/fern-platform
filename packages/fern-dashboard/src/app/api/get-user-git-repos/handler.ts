import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { GithubRepo } from "@/app/services/github/types";

export interface PaginatedGithubReposResponse {
  repos: GithubRepo[];
  hasMore: boolean;
  totalCount?: number;
}

const MAX_REPOS_TO_FETCH = 100; // GitHub API max fetchable at once is 100

export default async function getUserGithubRepos(
  userId: Auth0UserID,
  orgName: Auth0OrgName,
  page: number = 1
): Promise<PaginatedGithubReposResponse> {
  const session = await getCurrentSession();

  if (session == null) {
    return { repos: [], hasMore: false };
  }

  const octokit = await getOctokit(userId, orgName);

  if (octokit == null) {
    return { repos: [], hasMore: false };
  }

  const response = await octokit.request("GET /user/repos", {
    per_page: MAX_REPOS_TO_FETCH,
    page,
    affiliation: "organization_member",
  });

  const repos: GithubRepo[] = response.data
    .filter((repo) => {
      const permissions = repo.permissions;
      return permissions?.admin || permissions?.push || permissions?.maintain;
    })
    .map((repo) => ({
      name: repo.name,
      url: repo.html_url,
      avatarUrl: repo.owner.avatar_url,
      description: repo.description ?? "",
      stargazersCount: repo.stargazers_count,
      owner: repo.owner.name ?? "",
      organization:
        repo.owner.type === "Organization"
          ? (repo.owner.name ?? undefined)
          : undefined,
    }));

  // Check if there are more pages
  const hasMore =
    response.data.length === MAX_REPOS_TO_FETCH &&
    !!response.headers.link?.includes('rel="next"');

  return {
    repos,
    hasMore,
  };
}
