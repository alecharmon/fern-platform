import "server-only";

import { getGitHubAuthState } from "@/app/actions/getGithubMetadata";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getDocsGithubUrl } from "@/app/services/dal/github/getDocsGithubUrl";
import type { DocsUrl } from "@/utils/types";
import { FernCliVersionDisplay } from "./FernCliVersionDisplay";

/**
 * Async wrapper component for FernCliVersionDisplay that handles the promise resolution
 * This allows the parent to pass promises and let this component await them,
 * enabling proper Suspense boundary behavior
 */
export async function FernCliVersion({ orgName, docsUrl }: { orgName: Auth0OrgName; docsUrl: DocsUrl }) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    const [githubUrlResult, githubAuthStateResult] = await Promise.all([
        getDocsGithubUrl(docsUrl, session.accessToken),
        getGitHubAuthState(docsUrl, session.accessToken, orgName, session)
    ]);

    const githubUrl = githubUrlResult.success ? githubUrlResult.githubUrl : undefined;
    const baseBranch = "sourceRepo" in githubAuthStateResult ? githubAuthStateResult.sourceRepo?.baseBranch : undefined;

    return <FernCliVersionDisplay orgName={orgName} docsUrl={docsUrl} githubUrl={githubUrl} baseBranch={baseBranch} />;
}
