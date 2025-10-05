import { Octokit } from "@octokit/core";

import { getUserGithubToken } from "./management";
import type { Auth0UserID } from "./types";

export async function getUserOctokit(userId: Auth0UserID) {
    const gitHubToken = await getUserGithubToken(userId);
    if (gitHubToken == null) {
        return null;
    }
    return new Octokit({ auth: gitHubToken });
}
