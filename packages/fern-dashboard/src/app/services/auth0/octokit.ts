import { Octokit } from "@octokit/core";

import { checkOrgHasFlag } from "../edge-config/checkOrgHasFlag";
import { getUserGithubToken } from "./management";
import { Auth0OrgName, Auth0UserID } from "./types";

export async function getOctokit(userId: Auth0UserID, orgName?: Auth0OrgName) {
  let gitHubToken = null;
  if (orgName && (await checkOrgHasFlag(orgName, "bypassExtendedGithubAuth"))) {
    gitHubToken = process.env.FERN_SUPPORT_GITHUB_TOKEN;
  } else {
    gitHubToken = await getUserGithubToken(userId);
  }
  if (gitHubToken == null) {
    return null;
  }
  return new Octokit({ auth: gitHubToken });
}
