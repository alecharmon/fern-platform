import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { GithubSourceRepo } from "@/app/services/github/types";

import { GithubPermissionsProvider } from "./GithubPermissionsContext";

export async function GithubProtectedArea({
  children,
  sourceRepo: _sourceRepo,
}: {
  children: React.ReactNode;
  sourceRepo?: GithubSourceRepo;
}) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  return (
    <GithubPermissionsProvider writePermission={true}>
      {children}
    </GithubPermissionsProvider>
  );

  // const githubPermissions = await checkGitHubPermissions(session.user.sub);
  // if (!githubPermissions.hasRepoAccess) {
  //   return <AuthorizeGithubModal />;
  // }

  // const writePermission =
  //   sourceRepo?.owner && sourceRepo?.repo
  //     ? await checkWritePermissionToRepo(
  //         session.user.sub,
  //         sourceRepo.owner,
  //         sourceRepo.repo
  //       )
  //     : undefined;

  // return (
  //   <GithubPermissionsProvider writePermission={writePermission}>
  //     {children}
  //   </GithubPermissionsProvider>
  // );
}
