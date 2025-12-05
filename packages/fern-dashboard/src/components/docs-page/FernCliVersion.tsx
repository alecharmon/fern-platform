import "server-only";

import { getGitHubAuthState } from "@/app/actions/getGithubMetadata";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getDocsGitUrl } from "@/app/services/dal/github/getDocsGitUrl";
import { getFernVersionUpdateInfo } from "@/app/services/dal/github/getFernVersionUpdateInfo";
import type { DocsUrl } from "@/utils/types";
import { DocsSiteAttribute } from "./DocsSiteAttribute";
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
    const [gitUrlResult, githubAuthStateResult] = await Promise.all([
        getDocsGitUrl(docsUrl, session.accessToken),
        getGitHubAuthState(docsUrl, session.accessToken, orgName, session)
    ]);

    const gitUrl = gitUrlResult.success ? gitUrlResult.gitUrl : undefined;
    const baseBranch = "sourceRepo" in githubAuthStateResult ? githubAuthStateResult.sourceRepo?.baseBranch : undefined;

    if (gitUrl == null || baseBranch == null) {
        return null;
    }

    const fernVersionInfoResult = await getFernVersionUpdateInfo(gitUrl, docsUrl, baseBranch);

    if (!fernVersionInfoResult.ok) {
        return null;
    }

    return (
        <DocsSiteAttribute name="Fern CLI Version">
            <FernCliVersionDisplay
                orgName={orgName}
                docsUrl={docsUrl}
                gitUrl={gitUrl}
                baseBranch={baseBranch}
                fernVersionInfo={fernVersionInfoResult.result}
            />
        </DocsSiteAttribute>
    );
}
