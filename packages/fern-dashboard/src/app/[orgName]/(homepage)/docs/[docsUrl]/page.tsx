import "server-only";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getDocsGithubUrl } from "@/app/services/dal/github/getDocsGithubUrl";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { DocsPageTracker } from "@/components/docs-page/DocsPageTracker";
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

    // Get GitHub URL to determine source repo owner
    const githubUrlResult = await getDocsGithubUrl(docsUrl, session.accessToken);

    // Extract owner from GitHub URL (e.g., "https://github.com/owner/repo" -> "owner")
    let sourceRepoOwner: string | undefined;
    if (githubUrlResult.success) {
        const match = githubUrlResult.githubUrl?.match(/github\.com\/([^/]+)/);
        sourceRepoOwner = match?.[1];
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <DocsPageTracker orgName={orgName} docsUrl={docsUrl} userEmail={session.user.email ?? ""} />
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
