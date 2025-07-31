import { redirect } from "next/navigation";
import React from "react";

import checkGitHubPermissions, {
  checkWritePermissionToRepo,
} from "@/app/api/github-permissions/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { checkOrgHasFlag } from "@/app/services/edge-config/checkOrgHasFlag";

import { Page404 } from "../Page404";
import { AuthorizeGithubModal } from "../docs-page/AuthorizeGithubModal";

export declare namespace GithubExtendedAccessProtectedRoute {
  export interface Props {
    orgName: Auth0OrgName;
    owner: string | undefined;
    repo: string | undefined;
    children: React.JSX.Element;
  }
}

export const GithubExtendedAccessProtectedRoute = async ({
  orgName,
  owner,
  repo,
  children,
}: GithubExtendedAccessProtectedRoute.Props) => {
  const session = await getCurrentSession();

  if (session == null) {
    redirect("/");
  }

  const isUserInOrgFromUrl = await auth0Management.doesUserBelongsToOrg(
    session.user.sub,
    orgName
  );

  if (!isUserInOrgFromUrl) {
    return <Page404 />;
  }

  // Check if the org is enabled for bypassing GitHub authorization
  const shouldBypassGithubAuth = await checkOrgHasFlag(
    orgName,
    "bypassExtendedGithubAuth"
  );

  if (shouldBypassGithubAuth) {
    // When bypass is enabled, use the Fern support environment variable
    // The actual GitHub operations will use FERN_SUPPORT_GITHUB_TOKEN
    return children;
  }

  // Original GitHub authorization logic when bypass is not enabled
  if (owner && repo) {
    const writePermission = await checkWritePermissionToRepo(
      session.user.sub,
      orgName,
      owner,
      repo
    );
    if (!writePermission) {
      return (
        <AuthorizeGithubModal
          open
          persistent
          hideTrigger
          customMessage="You don't have write permission to this repo. Please obtain write permission and re-authorize to continue."
        />
      );
    }
  }

  const { hasRepoAccess } = await checkGitHubPermissions(session.user.sub);
  if (!hasRepoAccess) {
    return <AuthorizeGithubModal open persistent hideTrigger />;
  }

  return children;
};
