import "server-only";

import { Suspense } from "react";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getDocsGithubUrl } from "@/app/services/dal/github/getDocsGithubUrl";
import type { DocsUrl } from "@/utils/types";
import { VisualEditorContent } from "./VisualEditorContent";
import { VisualEditorContentAsync } from "./VisualEditorContentAsync";
import { VisualEditorContentSkeleton } from "./VisualEditorContentSkeleton";

/**
 * Outer shell that validates the GitHub URL and coordinates rendering
 * The expensive auth validation happens inside VisualEditorContentAsync
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
    // Only fetch the GitHub URL (fast, cached operation)
    const githubUrlResult = await getDocsGithubUrl(docsUrl, session.accessToken);

    const githubUrl = githubUrlResult.success ? githubUrlResult.githubUrl : undefined;

    // Handle early errors (missing GitHub URL)
    if (!githubUrlResult.success) {
        return (
            <VisualEditorContent
                docsUrl={docsUrl}
                session={session}
                orgName={orgName}
                githubUrl={githubUrl}
                error={githubUrlResult.error}
            />
        );
    }

    // Load the content with full validation via Suspense
    return (
        <Suspense fallback={<VisualEditorContentSkeleton />}>
            <VisualEditorContentAsync docsUrl={docsUrl} session={session} orgName={orgName} githubUrl={githubUrl} />
        </Suspense>
    );
}
