import "server-only";

import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getCachedDocsSitesForOrg } from "@/app/services/dal/fdr/cachedGetDocsSitesForOrg";
import { getCachedDocsGitUrl } from "@/app/services/dal/github/cachedGetDocsGitUrl";
import { getCachedRepoCollaboratorCount } from "@/app/services/dal/github/cachedGetRepoCollaboratorCount";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { docsPermissionScope } from "@/components/auth/authz";
import { AuthZWrapperServer } from "@/components/auth/authz/AuthZWrapperServer";
import { AddCollaboratorBanner } from "@/components/docs-page/AddCollaboratorBanner";
import { DocsPageTracker } from "@/components/docs-page/DocsPageTracker";
import { DocsSiteOverviewCard } from "@/components/docs-page/DocsSiteOverviewCard";
import { CriticalUpdateWarning } from "@/components/docs-page/visual-editor-section/CriticalUpdateWarning";
import { FinishDocsSetupBanner } from "@/components/docs-page/visual-editor-section/FinishDocsSetupBanner";
import { VisualEditorLoadingCard } from "@/components/docs-page/visual-editor-section/VisualEditorLoadingCard";
import { VisualEditorSection } from "@/components/docs-page/visual-editor-section/VisualEditorSection";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl, EncodedDocsUrl } from "@/utils/types";

/** Shared GitHub metadata used by both BannersSection and DocsSiteOverviewCardSync. */
interface GitHubMetadata {
    sourceRepoOwner: string | undefined;
    sourceRepoName: string | undefined;
    gitUrl: string | undefined;
    collaboratorCount: number | undefined;
}

/**
 * Fetches GitHub metadata once for the Overview page.
 * Both BannersSection and DocsSiteOverviewCardSync share this result
 * to avoid duplicate GitHub API calls.
 */
async function fetchGitHubMetadata(docsUrl: DocsUrl): Promise<GitHubMetadata> {
    const githubUrlResult = await getCachedDocsGitUrl(docsUrl);

    let sourceRepoOwner: string | undefined;
    let sourceRepoName: string | undefined;

    if (githubUrlResult.success && githubUrlResult.gitUrl) {
        const parsed = parseGitUrl(githubUrlResult.gitUrl);
        sourceRepoOwner = parsed.owner ?? undefined;
        sourceRepoName = parsed.repo ?? undefined;
    }

    const gitUrl = githubUrlResult.success ? githubUrlResult.gitUrl : undefined;

    let collaboratorCount: number | undefined;
    if (sourceRepoOwner != null && sourceRepoName != null) {
        const result = await getCachedRepoCollaboratorCount(sourceRepoOwner, sourceRepoName);
        if (result.success) {
            collaboratorCount = result.count;
        }
    }

    return { sourceRepoOwner, sourceRepoName, gitUrl, collaboratorCount };
}

function BannersSection({
    docsUrl,
    orgName,
    github
}: {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    github: GitHubMetadata;
}) {
    return (
        <AuthZWrapperServer
            permission="manage-settings"
            permissionScope={docsPermissionScope(docsUrl)}
            orgName={orgName}
        >
            <AddCollaboratorBanner
                docsUrl={docsUrl}
                sourceRepoOwner={github.sourceRepoOwner}
                sourceRepoName={github.sourceRepoName}
                collaboratorCount={github.collaboratorCount}
            />
            <FinishDocsSetupBanner docsUrl={docsUrl} orgName={orgName} gitUrl={github.gitUrl} />
            <CriticalUpdateWarning orgName={orgName} docsUrl={docsUrl} gitUrl={github.gitUrl} />
        </AuthZWrapperServer>
    );
}

function DocsSiteOverviewCardSync({
    docsUrl,
    docsSite,
    orgName,
    github
}: {
    docsUrl: DocsUrl;
    docsSite: Parameters<typeof DocsSiteOverviewCard>[0]["docsSite"];
    orgName: Auth0OrgName;
    github: GitHubMetadata;
}) {
    return (
        <DocsSiteOverviewCard
            docsUrl={docsUrl}
            docsSite={docsSite}
            orgName={orgName}
            sourceRepoOwner={github.sourceRepoOwner}
            sourceRepoName={github.sourceRepoName}
            collaboratorCount={github.collaboratorCount}
        />
    );
}

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }> }) {
    const { orgName, docsUrl: encodedDocsUrl } = await props.params;

    const session = await getAuthenticatedSessionOrRedirect(orgName);
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

    // Validate that the docsUrl belongs to this organization (required before rendering anything)
    const response = await getCachedDocsSitesForOrg({
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

    // Fetch GitHub metadata once and share between BannersSection and DocsSiteOverviewCardSync
    const github = await fetchGitHubMetadata(docsUrl);

    return (
        <div className="flex w-full flex-col gap-4">
            <DocsPageTracker orgName={orgName} docsUrl={docsUrl} userEmail={session.user.email ?? ""} />
            {/* Banners render synchronously since GitHub data is already fetched above */}
            <Suspense fallback={null}>
                <BannersSection docsUrl={docsUrl} orgName={orgName} github={github} />
            </Suspense>
            <DocsSiteOverviewCardSync docsUrl={docsUrl} docsSite={currentDocsSite} orgName={orgName} github={github} />
            <Suspense fallback={<VisualEditorLoadingCard />}>
                <VisualEditorSection docsUrl={docsUrl} session={session} orgName={orgName} />
            </Suspense>
        </div>
    );
}
