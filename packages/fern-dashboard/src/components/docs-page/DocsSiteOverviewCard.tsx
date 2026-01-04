import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { Suspense } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

import Card from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { CustomDomainSection } from "./CustomDomainSection";
import { DocsSiteAttribute } from "./DocsSiteAttribute";
import { DocsSiteLink } from "./DocsSiteLink";
import { DocsSiteImageServer } from "./docs-site-image/DocsSiteImageServer";
import { SkeletonDocsSiteImage } from "./docs-site-image/SkeletonDocsSiteImage";
import { FernCliVersion } from "./FernCliVersion";
import { GitSource } from "./GitSource";

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
                <Suspense fallback={<SkeletonDocsSiteImage />}>
                    <DocsSiteImageServer docsSite={docsSite} />
                </Suspense>
                <div className="flex min-w-0 flex-col gap-4 text-gray-900">
                    <div className="flex flex-col gap-2">
                        <p>Domains</p>
                        <div className="flex flex-col items-start gap-1">
                            {docsSite.urls.map((url) => (
                                <DocsSiteLink key={`${url.domain}${url.path}`} docsSiteUrl={url} />
                            ))}
                        </div>
                        <Suspense fallback={<Skeleton className="h-8 w-40" />}>
                            <CustomDomainSection
                                docsUrl={docsUrl}
                                orgName={orgName}
                                allDomains={docsSite.urls.map((url) => url.domain)}
                            />
                        </Suspense>
                    </div>
                    <div className="flex flex-wrap gap-x-10 gap-y-4">
                        <DocsSiteAttribute name="Source">
                            <Suspense fallback={<Skeleton className="h-6 w-24" />}>
                                <GitSource docsUrl={docsUrl} />
                            </Suspense>
                        </DocsSiteAttribute>
                        <Suspense
                            fallback={
                                // Create a skeleton that matches DocsSiteAttribute layout
                                <div className="flex w-fit flex-col gap-2">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-6 w-24" />
                                </div>
                            }
                        >
                            <FernCliVersion orgName={orgName} docsUrl={docsUrl} />
                        </Suspense>
                    </div>
                </div>
            </Card>
        </div>
    );
}
