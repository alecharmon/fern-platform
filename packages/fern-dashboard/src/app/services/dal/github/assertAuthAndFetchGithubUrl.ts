import { redirect } from "next/navigation";
import { cache } from "react";

import { DocsUrl } from "@/utils/types";

import { getCurrentSession } from "../../auth0/getCurrentSession";
import { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";
import getDocsGithubUrl from "./getDocsGithubUrl";
import { assertGithubAccessByUrl } from "./validators";

export const assertAuthAndFetchGithubUrl = cache(
  async ({ orgName, docsUrl }: { orgName: Auth0OrgName; docsUrl: DocsUrl }) => {
    // Validate session
    const session = await getCurrentSession();
    if (session == null) {
      redirect("/");
    }

    // Validate organization access
    await assertUserHasOrganizationAccess({
      userId: session.user.sub,
      orgName,
    });

    // Validate GitHub access
    const urlResult = await getDocsGithubUrl({
      url: docsUrl,
      token: session.accessToken,
    });
    if (!urlResult.success) {
      redirect(`/${orgName}/docs`);
    }
    const githubUrl = urlResult.githubUrl;
    await assertGithubAccessByUrl(orgName, githubUrl);

    return { githubUrl, session };
  }
);
