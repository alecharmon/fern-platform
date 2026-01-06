import "server-only";

import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getDocsGitUrl } from "@/app/services/dal/github/getDocsGitUrl";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { docsPermissionScope } from "@/components/auth/authz";
import { AuthZWrapperServer } from "@/components/auth/authz/AuthZWrapperServer";
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

    // Get git URL to determine source repo owner
    const githubUrlResult = await getDocsGitUrl(docsUrl, session.accessToken);

    // Extract owner from git URL
    let sourceRepoOwner: string | undefined;

    if (githubUrlResult.success && githubUrlResult.gitUrl) {
        const parsed = parseGitUrl(githubUrlResult.gitUrl);
        sourceRepoOwner = parsed.owner ?? undefined;
    }

    const gitUrl = githubUrlResult.success ? githubUrlResult.gitUrl : undefined;

    return (
        <div className="flex w-full flex-col gap-4">
            <DocsPageTracker orgName={orgName} docsUrl={docsUrl} userEmail={session.user.email ?? ""} />
            <AuthZWrapperServer
                permission="manage-settings"
                permissionScope={docsPermissionScope(docsUrl)}
                orgName={orgName}
            >
                <TransferRepoOwnershipBanner docsUrl={docsUrl} sourceRepoOwner={sourceRepoOwner} />
                <FinishDocsSetupBanner docsUrl={docsUrl} orgName={orgName} gitUrl={gitUrl} />
                <CriticalUpdateWarning orgName={orgName} docsUrl={docsUrl} gitUrl={gitUrl} />
            </AuthZWrapperServer>
            <DocsSiteOverviewCard docsUrl={docsUrl} docsSite={currentDocsSite} orgName={orgName} />
            <Suspense fallback={<VisualEditorLoadingCard />}>
                <VisualEditorSection docsUrl={docsUrl} session={session} orgName={orgName} />
            </Suspense>
        </div>
    );
}
