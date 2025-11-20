import "server-only";

import { Suspense } from "react";
import { getGitHubAuthState } from "@/app/actions/getGithubMetadata";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { GithubAuthState } from "@/components/docs-page/GithubSourceClient";
import type { DocsUrl } from "@/utils/types";
import { CriticalUpdateWarning } from "./CriticalUpdateWarning";
import { VisualEditorContent } from "./VisualEditorContent";

/**
 * Handles the expensive GitHub auth validation and prepares data for rendering
 * This component is wrapped in Suspense, so it can stream in after initial page load
 */
export async function VisualEditorContentAsync({
    docsUrl,
    session,
    orgName,
    githubUrl
}: {
    docsUrl: DocsUrl;
    session: Auth0SessionData;
    orgName: Auth0OrgName;
    githubUrl?: string;
}) {
    // Fetch GitHub auth state (expensive operation)
    const githubAuthStateResult = await getGitHubAuthState(docsUrl, session.accessToken, orgName, session);

    // Ensure we have a proper GithubAuthState, handling both error shapes
    let githubAuthState: GithubAuthState;

    if ("success" in githubAuthStateResult && githubAuthStateResult.success === false) {
        githubAuthState = {
            validationResult: {
                ok: false,
                error: githubAuthStateResult.error
            },
            sourceRepo: undefined,
            isLoading: false
        };
    } else if ("validationResult" in githubAuthStateResult) {
        githubAuthState = githubAuthStateResult;
    } else {
        githubAuthState = {
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
    }

    // Check for validation errors
    if (!githubAuthState.validationResult.ok) {
        return (
            <VisualEditorContent
                docsUrl={docsUrl}
                session={session}
                orgName={orgName}
                githubUrl={githubUrl}
                error={githubAuthState.validationResult.error}
            />
        );
    }

    const baseBranch = githubAuthState.sourceRepo?.baseBranch;

    // This should never happen because this would be caught by the validation handler above
    if (baseBranch == null) {
        return (
            <VisualEditorContent
                docsUrl={docsUrl}
                session={session}
                orgName={orgName}
                githubUrl={githubUrl}
                error={{
                    type: "UNEXPECTED_ERROR",
                    message: "GitHub URL or base branch was not found."
                }}
            />
        );
    }

    // Prepare the critical update warning as a separate suspense boundary
    const criticalUpdateWarning = (
        <Suspense fallback={null}>
            <CriticalUpdateWarning orgName={orgName} docsUrl={docsUrl} githubUrl={githubUrl} baseBranch={baseBranch} />
        </Suspense>
    );

    // Validation passed! Render the content with the Go to Editor button
    return (
        <VisualEditorContent
            docsUrl={docsUrl}
            session={session}
            orgName={orgName}
            githubUrl={githubUrl}
            sourceRepo={githubAuthState.sourceRepo}
            criticalUpdateWarning={criticalUpdateWarning}
        />
    );
}
