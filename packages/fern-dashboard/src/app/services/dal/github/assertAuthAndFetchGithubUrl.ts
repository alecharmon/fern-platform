import { validateGitRepoAccess } from "@/app/services/dal/git/validateGitRepoAccess";
import type { DocsUrl } from "@/utils/types";

import { getCurrentSession } from "../../auth0/getCurrentSession";
import { redirectToLogin } from "../../auth0/redirectToLogin";
import type { Auth0OrgName } from "../../auth0/types";
import { assertUserHasOrganizationAccess } from "../organization";
import { getDocsGitUrl } from "./getDocsGitUrl";

export const assertAuthAndFetchGithubUrl = async (orgName: Auth0OrgName, docsUrl: DocsUrl) => {
    // Validate session
    const session = await getCurrentSession();
    if (session == null) {
        await redirectToLogin();
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

    const validationResult = await validateGitRepoAccess(orgName, docsUrl, gitUrl);
    if (!validationResult.ok) {
        console.warn(
            "[assertAuthAndFetchGithubUrl] Failed to validate repo access, falling back to preview mode",
            validationResult.error
        );
        return { gitUrl: null, session };
    }

    return { gitUrl, session };
};
