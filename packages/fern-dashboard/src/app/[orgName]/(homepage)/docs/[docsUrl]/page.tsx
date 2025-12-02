import "server-only";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getDocsGithubUrl } from "@/app/services/dal/github/getDocsGithubUrl";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import { DocsPageTracker } from "@/components/docs-page/DocsPageTracker";
import { DocsSiteOverviewCard } from "@/components/docs-page/DocsSiteOverviewCard";
import { TransferRepoOwnershipBanner } from "@/components/docs-page/TransferRepoOwnershipBanner";
import { CriticalUpdateWarning } from "@/components/docs-page/visual-editor-section/CriticalUpdateWarning";
import { FinishDocsSetupBanner } from "@/components/docs-page/visual-editor-section/FinishDocsSetupBanner";
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

    // Get GitHub URL to determine source repo owner and fetch validation data
    const githubUrlResult = await getDocsGithubUrl(docsUrl, session.accessToken);

    // Extract owner from GitHub URL (e.g., "https://github.com/owner/repo" -> "owner")
    let sourceRepoOwner: string | undefined;
    const githubUrl = githubUrlResult.success ? githubUrlResult.githubUrl : undefined;

    if (githubUrlResult.success && githubUrl) {
        const { owner } = getOwnerAndRepoFromGithubUrl(githubUrl);
        sourceRepoOwner = owner ?? undefined;
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <TransferRepoOwnershipBanner docsUrl={docsUrl} sourceRepoOwner={sourceRepoOwner} />
            <DocsPageTracker orgName={orgName} docsUrl={docsUrl} userEmail={session.user.email ?? ""} />
            <FinishDocsSetupBanner docsUrl={docsUrl} orgName={orgName} githubUrl={githubUrl} />
            <CriticalUpdateWarning orgName={orgName} docsUrl={docsUrl} githubUrl={githubUrl} />
            <DocsSiteOverviewCard docsUrl={docsUrl} docsSite={currentDocsSite} orgName={orgName} />
            <Suspense fallback={<VisualEditorLoadingCard />}>
                <VisualEditorSection docsUrl={docsUrl} session={session} orgName={orgName} />
            </Suspense>
        </div>
    );
}
