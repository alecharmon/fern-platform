import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOctokit } from "@/app/services/auth0/octokit";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { createPrDescriptionService } from "@/app/services/pr-description";

export default async function generatePrDescription(
  userId: Auth0UserID,
  orgName: Auth0OrgName,
  request: {
    owner: string;
    repo: string;
    branch: string;
    baseBranch?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
  newTitle?: string;
}> {
  const session = await getCurrentSession();
  if (session == null) {
    return { success: false, error: "No session found" };
  }

  const octokit = await getOctokit(userId, orgName);
  if (octokit == null) {
    return { success: false, error: "Failed to get GitHub client" };
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return { success: false, error: "ANTHROPIC_API_KEY not configured" };
  }

  const prDescriptionService = createPrDescriptionService(
    octokit,
    anthropicApiKey
  );

  return await prDescriptionService.generateAndUpdatePrTitleAndDescription(
    request
  );
}
