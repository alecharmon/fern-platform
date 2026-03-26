import { Octokit } from "@octokit/core";

import { instrumentOctokitRateLimits } from "@/app/services/github/github-rate-limit-metrics";
import { withRequestTracking } from "@/app/services/github/trackGithubRequest";

import { getUserGithubToken } from "./management";
import type { Auth0UserID } from "./types";

export async function getUserOctokit(userId: Auth0UserID, caller: string) {
    const gitHubToken = await getUserGithubToken(userId);
    if (gitHubToken == null) {
        return null;
    }
    const octokit = new Octokit({ auth: gitHubToken });
    instrumentOctokitRateLimits(octokit, "user", caller);
    return withRequestTracking(octokit);
}
