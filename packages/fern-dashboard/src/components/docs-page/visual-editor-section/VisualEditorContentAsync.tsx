import "server-only";

import { getGitHubAuthState } from "@/app/actions/getGithubMetadata";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";
import type { DocsUrl } from "@/utils/types";
import { VisualEditorContent } from "./VisualEditorContent";

/**
 * Handles the expensive GitHub auth validation and prepares data for rendering
 * This component is wrapped in Suspense, so it can stream in after initial page load
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
    // Fetch GitHub auth state (expensive operation)
    const githubAuthStateResult = await getGitHubAuthState(docsUrl, session.accessToken, orgName, session);

    const isPreviewModeEnabled = await isFeatureFlagEnabledForUser(
        PosthogFeatureFlag.ENABLE_FERN_EDITOR_PREVIEW,
        session.user.sub,
        orgName
    );

    // Check for validation errors
    if (!githubAuthStateResult.success || !githubAuthStateResult.validationResult.ok) {
        return <VisualEditorContent docsUrl={docsUrl} session={session} buttonDisabled={!isPreviewModeEnabled} />;
    }

    const baseBranch = githubAuthStateResult.sourceRepo?.baseBranch;

    // This should never happen because this would be caught by the validation handler above
    if (baseBranch == null) {
        return <VisualEditorContent docsUrl={docsUrl} session={session} buttonDisabled={!isPreviewModeEnabled} />;
    }

    // Validation passed! Render the content with the Go to Editor button
    return <VisualEditorContent docsUrl={docsUrl} session={session} sourceRepo={githubAuthStateResult.sourceRepo} />;
}
