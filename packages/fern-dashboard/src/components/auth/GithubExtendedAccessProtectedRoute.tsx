import { redirect } from "next/navigation";
import React from "react";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";

import { Page404 } from "../Page404";

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
  owner: _owner,
  repo: _repo,
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

  // if (owner && repo) {
  //   const writePermission = await checkWritePermissionToRepo(
  //     session.user.sub,
  //     owner,
  //     repo
  //   );
  //   if (!writePermission) {
  //     return (
  //       <AuthorizeGithubModal
  //         open
  //         persistent
  //         hideTrigger
  //         customMessage="You don't have write permission to this repo. Please obtain write permission and re-authorize to continue."
  //       />
  //     );
  //   }
  // }

  // const { hasRepoAccess } = await checkGitHubPermissions(session.user.sub);
  // if (!hasRepoAccess) {
  //   return <AuthorizeGithubModal open persistent hideTrigger />;
  // }

  return children;
};
