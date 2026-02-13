import "server-only";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";
import { AuthZWrapperServer } from "../auth/authz/AuthZWrapperServer";
import { AddMoreCollaboratorsButton } from "./AddMoreCollaboratorsButton";
import { CustomDomainSection } from "./CustomDomainSection";
import { DocsSiteAttribute } from "./DocsSiteAttribute";
import { DocsSiteLink } from "./DocsSiteLink";
import { FernCliVersion } from "./FernCliVersion";
import { GitSource } from "./GitSource";

const FERN_OWNED_ACCOUNTS = ["fern-support", "fern", "fern-demo"];

interface DocsSiteOverviewCardContentProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    urls: FdrAPI.dashboard.DocsSiteUrl[];
    sourceRepoOwner?: string;
    sourceRepoName?: string;
    collaboratorCount?: number;
}

/**
 * Server component that renders the card content with parallel data fetching.
 * By placing CustomDomainSection, GitSource, and FernCliVersion in the same
 * async component, their data fetching happens in parallel rather than
 * sequentially through nested Suspense boundaries.
 */
export async function DocsSiteOverviewCardContent({
    docsUrl,
    orgName,
    urls,
    sourceRepoOwner,
    sourceRepoName,
    collaboratorCount
}: DocsSiteOverviewCardContentProps) {
    const allDomains = urls.map((url) => url.domain);

    // These components are async server components that fetch data.
    // Rendering them together in a single parent allows React to
    // initiate all their data fetches in parallel.
    const [customDomainContent, gitSourceContent, fernCliVersionContent] = await Promise.all([
        CustomDomainSection({ docsUrl, orgName, allDomains }),
        GitSource({ docsUrl, orgName }),
        FernCliVersion({ orgName, docsUrl })
    ]);

    return (
        <div className="flex min-w-0 flex-col gap-4 text-gray-900">
            <div className="flex flex-col gap-2">
                <p>Domains</p>
                <div className="flex flex-col items-start gap-1">
                    {urls.map((url) => (
                        <DocsSiteLink key={`${url.domain}${url.path}`} docsSiteUrl={url} />
                    ))}
                </div>
                <AuthZWrapperServer permission="super-user">{customDomainContent}</AuthZWrapperServer>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
                <DocsSiteAttribute name="Source">
                    {gitSourceContent}
                    {sourceRepoOwner != null &&
                        sourceRepoName != null &&
                        collaboratorCount != null &&
                        collaboratorCount > 0 &&
                        FERN_OWNED_ACCOUNTS.includes(sourceRepoOwner) && (
                            <AddMoreCollaboratorsButton
                                docsUrl={docsUrl}
                                orgName={orgName}
                                sourceRepoName={sourceRepoName}
                            />
                        )}
                </DocsSiteAttribute>
                {fernCliVersionContent}
            </div>
        </div>
    );
}
