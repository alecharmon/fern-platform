import { Auth0OrgName } from "../auth0/types";
import { DashboardApiClient } from "../dashboard-api/client";

export async function handleCreatePr({
  orgName,
  branch,
  owner,
  repo,
  baseBranch,
}: {
  orgName: Auth0OrgName;
  branch: string;
  owner: string;
  repo: string;
  baseBranch: string;
}): Promise<string | undefined> {
  try {
    const response = await DashboardApiClient.postCreatePr({
      orgName,
      owner,
      repo,
      head: branch,
      base: baseBranch,
      title: "Visual Editor: Update",
    });
    if (response.success) {
      try {
        // No need to await this, we just want to try to generate a PR description.
        void handleGeneratePrDescription({
          orgName,
          branch,
          owner,
          repo,
          baseBranch,
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
  repo,
  baseBranch,
}: {
  orgName: Auth0OrgName;
  branch: string;
  owner: string;
  repo: string;
  baseBranch: string;
}) {
  await DashboardApiClient.generatePrDescription({
    orgName,
    owner,
    repo,
    branch,
    baseBranch,
  });
}
