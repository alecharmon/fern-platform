import "server-only";

import { getCachedGitHubAuthState } from "@/app/actions/cachedGetGithubAuthState";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";
import { VisualEditorContent } from "./VisualEditorContent";

/**
 * Handles the expensive GitHub auth validation and prepares data for rendering
 * This component is wrapped in Suspense, so it can stream in after initial page load.
 * Uses getCachedGitHubAuthState for persistent caching across page navigations.
 */
export async function VisualEditorContentAsync({
    docsUrl,
    session,
    orgName
}: {
    docsUrl: DocsUrl;
    session: Auth0SessionData;
    orgName: Auth0OrgName;
}) {
    // Fetch GitHub auth state (cached across navigations — keyed on docsUrl, orgName, userId)
    const githubAuthStateResult = await getCachedGitHubAuthState(docsUrl, orgName, session.user.sub);

    // Check for validation errors
    if (!githubAuthStateResult.success || !githubAuthStateResult.validationResult.ok) {
        return <VisualEditorContent docsUrl={docsUrl} user={{ sub: session.user.sub, name: session.user.name }} />;
    }

    const baseBranch = githubAuthStateResult.sourceRepo?.baseBranch;

    // This should never happen because this would be caught by the validation handler above
    if (baseBranch == null) {
        return <VisualEditorContent docsUrl={docsUrl} user={{ sub: session.user.sub, name: session.user.name }} />;
    }

    // Validation passed! Render the content with the Go to Editor button
    return (
        <VisualEditorContent
            docsUrl={docsUrl}
            user={{ sub: session.user.sub, name: session.user.name }}
            sourceRepo={githubAuthStateResult.sourceRepo}
        />
    );
}
