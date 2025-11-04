import "server-only";

import { getGitHubAuthState } from "@/app/actions/getGithubMetadata";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getDocsGithubUrl } from "@/app/services/dal/github/getDocsGithubUrl";
import type { GithubAuthState } from "@/components/docs-page/GithubSourceClient";
import type { DocsUrl } from "@/utils/types";
import { CriticalUpdateWarning } from "./CriticalUpdateWarning";
import { VisualEditorEmptyCard } from "./VisualEditorEmptyCard";
import { VisualEditorSectionClient } from "./VisualEditorSectionClient";
import { VisualEditorValidationErrorHandler } from "./VisualEditorValidationErrorHandler";

/**
 * Async wrapper component for VisualEditorSection that handles the promise resolution
 * This allows the parent to pass promises and let this component await them,
 * enabling proper Suspense boundary behavior
 */
export async function VisualEditorSection({
    docsUrl,
    session,
    orgName
}: {
    docsUrl: DocsUrl;
    session: Auth0SessionData;
    orgName: Auth0OrgName;
}) {
    const [githubUrlResult, githubAuthStateResult] = await Promise.all([
        getDocsGithubUrl(docsUrl, session.accessToken),
        getGitHubAuthState(docsUrl, session.accessToken, orgName, session)
    ]);

    const githubUrl = githubUrlResult.success ? githubUrlResult.githubUrl : undefined;

    // Ensure we have a proper GithubAuthState, not an error result
    const githubAuthState: GithubAuthState =
        "validationResult" in githubAuthStateResult
            ? githubAuthStateResult
            : {
                  validationResult: {
                      ok: false,
                      error: {
                          type: "UNEXPECTED_ERROR",
                          message: "Failed to load GitHub auth state"
                      }
                  },
                  sourceRepo: undefined,
                  isLoading: false
              };

    if (!githubAuthState.validationResult.ok) {
        return (
            <VisualEditorEmptyCard>
                <VisualEditorValidationErrorHandler
                    error={githubAuthState.validationResult.error}
                    githubUrl={githubUrl}
                    orgName={orgName}
                    site={docsUrl}
                />
            </VisualEditorEmptyCard>
        );
    }
    const baseBranch = githubAuthState.sourceRepo?.baseBranch;

    // This should never happen because this would be caught by the validation handler above, but added to mitigate type errors
    if (githubUrl == null || baseBranch == null) {
        return (
            <VisualEditorEmptyCard>
                <VisualEditorValidationErrorHandler
                    error={{
                        type: "UNEXPECTED_ERROR",
                        message: "GitHub URL or base branch is was not found."
                    }}
                    githubUrl={githubUrl}
                    orgName={orgName}
                    site={docsUrl}
                />
            </VisualEditorEmptyCard>
        );
    }

    return (
        <VisualEditorSectionClient
            maybeCriticalUpdateWarning={
                <CriticalUpdateWarning
                    orgName={orgName}
                    docsUrl={docsUrl}
                    githubUrl={githubUrl}
                    baseBranch={baseBranch}
                />
            }
            session={session}
            docsUrl={docsUrl}
            sourceRepo={githubAuthState.sourceRepo}
        />
    );
}
