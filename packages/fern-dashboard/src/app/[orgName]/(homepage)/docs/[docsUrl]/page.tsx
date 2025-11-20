import "server-only";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getDocsGitUrl } from "@/app/services/dal/git/getDocsGitUrl";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { DocsSiteOverviewCard } from "@/components/docs-page/DocsSiteOverviewCard";
import { PublishToGitHubButton } from "@/components/docs-page/PublishToGitHubButton";
import { VisualEditorLoadingCard } from "@/components/docs-page/visual-editor-section/VisualEditorLoadingCard";
import { VisualEditorSection } from "@/components/docs-page/visual-editor-section/VisualEditorSection";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }> }) {
    const { orgName, docsUrl: encodedDocsUrl } = await props.params;

    const session = await getAuthenticatedSessionOrRedirect(orgName);
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

    // Validate that the docsUrl belongs to this organization so that we avoid errors in the page
    const response = await getDocsSitesForOrg({
        orgName,
        token: session.accessToken
    });
    if (!response.ok) {
        console.warn("Failed to get docs sites for org: ", JSON.stringify(response.error, null, 2));
        notFound();
    }
    const currentDocsSite = response.docsSites.find((site) => getDocsSiteUrl(site) === docsUrl);
    if (currentDocsSite == null) {
        notFound();
    }

    // Get git URL to determine source repo owner
    const gitUrlResult = await getDocsGitUrl(docsUrl, session.accessToken);

    // Extract owner from git URL (works for both GitHub and GitLab)
    // e.g., "https://github.com/owner/repo" -> "owner"
    // e.g., "https://gitlab.com/owner/repo" -> "owner"
    let sourceRepoOwner: string | undefined;
    if (gitUrlResult.success && gitUrlResult.gitUrl) {
        const match = gitUrlResult.gitUrl.match(/(?:github\.com|gitlab\.com)\/([^/]+)/);
        sourceRepoOwner = match?.[1];
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <PublishToGitHubButton
                docsUrl={docsUrl}
                docsSiteName={currentDocsSite.title ?? "Docs"}
                sourceRepoOwner={sourceRepoOwner}
            />
            <DocsSiteOverviewCard docsUrl={docsUrl} docsSite={currentDocsSite} orgName={orgName} />
            <Suspense fallback={<VisualEditorLoadingCard />}>
                <VisualEditorSection docsUrl={docsUrl} session={session} orgName={orgName} />
            </Suspense>
        </div>
    );
}
