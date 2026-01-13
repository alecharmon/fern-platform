import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getDocsGitUrl } from "@/app/services/dal/github/getDocsGitUrl";
import type { DocsUrl } from "@/utils/types";

import { GitSourceClient } from "./GitSourceClient";

/**
 * Async wrapper component for GithubSourceClient that handles the fetching of
 * the GitHub URL to pass to our display component.
 */
export async function GitSource({ docsUrl, orgName }: { docsUrl: DocsUrl; orgName: Auth0OrgName }) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    const gitUrlResult = await getDocsGitUrl(docsUrl, session?.accessToken);

    return (
        <GitSourceClient
            docsUrl={docsUrl}
            orgName={orgName}
            gitUrl={gitUrlResult.success ? gitUrlResult.gitUrl : undefined}
        />
    );
}
