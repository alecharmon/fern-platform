import { redirect } from "next/navigation";
import { cache } from "react";

import type { DocsUrl } from "@/utils/types";

import { getCurrentSession } from "../../auth0/getCurrentSession";
import type { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";
import { getDocsGitUrl } from "./getDocsGitUrl";
import { assertRepoAccessByUrl } from "./validators";

export const assertAuthAndFetchGitUrl = cache(async (orgName: Auth0OrgName, docsUrl: DocsUrl) => {
    // Validate session
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }

    console.debug(`[assertAuthAndFetchGitUrl] Validating access for org: ${orgName}, docsUrl: ${docsUrl}`);

    // Validate organization access
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Validate Git access
    const urlResult = await getDocsGitUrl(docsUrl, session.accessToken);
    if (!urlResult.success) {
        redirect(`/${orgName}/docs`);
    }

    const gitUrl = urlResult.gitUrl;
    console.debug(`[assertAuthAndFetchGitUrl] Found git url: ${gitUrl}`);
    await assertRepoAccessByUrl(orgName, docsUrl, gitUrl);

    return { gitUrl, session };
});
