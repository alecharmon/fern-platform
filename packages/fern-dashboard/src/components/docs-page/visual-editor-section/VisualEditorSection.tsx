import "server-only";

import { Suspense } from "react";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getCachedDocsGitUrl } from "@/app/services/dal/github/cachedGetDocsGitUrl";
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
    // Only fetch the Git URL (fast, cached with "use cache" for 1 hour)
    const gitUrlResult = await getCachedDocsGitUrl(docsUrl);

    // Handle early errors (missing GitHub URL)
    if (!gitUrlResult.success) {
        return <VisualEditorContent docsUrl={docsUrl} user={{ sub: session.user.sub, name: session.user.name }} />;
    }

    // Load the content with full validation via Suspense
    return (
        <Suspense fallback={<VisualEditorContentSkeleton />}>
            <VisualEditorContentAsync docsUrl={docsUrl} session={session} orgName={orgName} />
        </Suspense>
    );
}
