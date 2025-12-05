import { redirect } from "next/navigation";

import type { DocsUrl } from "@/utils/types";

import { getCurrentSession } from "../../auth0/getCurrentSession";
import type { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";
import { getDocsGitUrl } from "./getDocsGitUrl";
import { assertRepoAccessByUrl } from "./validators";

export const assertAuthAndFetchGithubUrl = async (orgName: Auth0OrgName, docsUrl: DocsUrl) => {
    // Validate session
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }

    console.debug(`[assertAuthAndFetchGithubUrl] Validating access for org: ${orgName}, docsUrl: ${docsUrl}`);

    // Validate organization access
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Validate GitHub access
    const urlResult = await getDocsGitUrl(docsUrl, session.accessToken);
    if (!urlResult.success) {
        return { githubUrl: null, session };
    }

    const gitUrl = urlResult.gitUrl;
    console.debug(`[assertAuthAndFetchGithubUrl] Found github url: ${gitUrl}`);
    try {
        await assertRepoAccessByUrl(orgName, docsUrl, gitUrl);
    } catch (error) {
        console.warn("[assertAuthAndFetchGithubUrl] Failed to assert repo access, falling back to preview mode", error);
        return { gitUrl: null, session };
    }

    return { gitUrl, session };
};
