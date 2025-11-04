import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { Suspense } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

import Card from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { DocsSiteAttribute } from "./DocsSiteAttribute";
import { DocsSiteLink } from "./DocsSiteLink";
import { DownloadFernDocsButton } from "./DownloadFernDocsButton";
import { DocsSiteImage } from "./docs-site-image/DocsSiteImage";
import { FernCliVersion } from "./FernCliVersion";
import { GithubSource } from "./GithubSource";
import { PublishToGitHubButton } from "./PublishToGitHubButton";

export async function DocsSiteOverviewCard({
    docsSite,
    docsUrl,
    orgName
}: {
    docsUrl: DocsUrl;
    docsSite: FdrAPI.dashboard.DocsSite;
    orgName: Auth0OrgName;
}) {
    return (
        <div className="flex w-full flex-col gap-4">
            <Card className="flex flex-col md:flex-row">
                <DocsSiteImage docsSite={docsSite} />
                <div className="flex min-w-0 flex-col gap-4 text-gray-900">
                    <div className="flex flex-col gap-2">
                        <p>Domains</p>
                        <div className="flex flex-col items-start gap-1">
                            {docsSite.urls.map((url) => (
                                <DocsSiteLink key={`${url.domain}${url.path}`} docsSiteUrl={url} />
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-10 gap-y-4">
                        <DocsSiteAttribute name="Source">
                            <Suspense fallback={<Skeleton className="h-6 w-24" />}>
                                <GithubSource docsUrl={docsUrl} />
                            </Suspense>
                        </DocsSiteAttribute>
                        <DocsSiteAttribute name="Fern CLI Version">
                            <Suspense fallback={<Skeleton className="h-6 w-24" />}>
                                <FernCliVersion orgName={orgName} docsUrl={docsUrl} />
                            </Suspense>
                        </DocsSiteAttribute>
                        <DownloadFernDocsButton docsUrl={docsUrl} />
                        <PublishToGitHubButton docsUrl={docsUrl} docsSiteName={docsSite.title ?? "Docs"} />
                    </div>
                </div>
            </Card>
        </div>
    );
}
