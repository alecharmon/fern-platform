import { redirect } from "next/navigation";

import { checkWritePermissionToRepo } from "@/app/api/github-permissions/handler";
import checkGitHubPermissions from "@/app/api/github-permissions/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { checkOrgHasFlag } from "@/app/services/edge-config/checkOrgHasFlag";
import { GithubSourceRepo } from "@/app/services/github/types";

import { AuthorizeGithubModal } from "./AuthorizeGithubModal";
import { GithubPermissionsProvider } from "./GithubPermissionsContext";

export async function GithubProtectedArea({
  children,
  sourceRepo,
  orgName,
}: {
  children: React.ReactNode;
  sourceRepo?: GithubSourceRepo;
  orgName: Auth0OrgName;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  const bypassExtendedGithubAuth = await checkOrgHasFlag(
    orgName,
    "bypassExtendedGithubAuth"
  );

  // If we are bypassing extended github auth, we can just return the children
  // without checking for write permissions because a user won't be able to provide
  // fern-support with additional permissions.
  // TODO: We should still check for write permissions for fern-suppport, but we should
  // surface a different error message to the user.
  if (bypassExtendedGithubAuth) {
    return (
      <GithubPermissionsProvider writePermission={true}>
        {children}
      </GithubPermissionsProvider>
    );
  }

  const githubPermissions = await checkGitHubPermissions(
    session.user.sub,
    orgName
  );
  if (!githubPermissions.hasRepoAccess) {
    return <AuthorizeGithubModal />;
  }

  const writePermission =
    sourceRepo?.owner && sourceRepo?.repo
      ? await checkWritePermissionToRepo(
          session.user.sub,
          orgName,
          sourceRepo.owner,
          sourceRepo.repo
        )
      : undefined;

  return (
    <GithubPermissionsProvider writePermission={writePermission}>
      {children}
    </GithubPermissionsProvider>
  );
}
