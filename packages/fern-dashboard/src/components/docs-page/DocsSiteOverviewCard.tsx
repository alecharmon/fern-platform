import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { Suspense } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

import Card from "../ui/card";
import { DocsSiteOverviewCardContent } from "./DocsSiteOverviewCardContent";
import { DocsSiteImageServer } from "./docs-site-image/DocsSiteImageServer";
import { SkeletonDocsSiteImage } from "./docs-site-image/SkeletonDocsSiteImage";
import { SkeletonDocsSiteOverviewCardContent } from "./SkeletonDocsSiteOverviewCardContent";

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
                {/* Image and content load in parallel via sibling Suspense boundaries */}
                <Suspense fallback={<SkeletonDocsSiteImage />}>
                    <DocsSiteImageServer docsSite={docsSite} />
                </Suspense>
                <Suspense fallback={<SkeletonDocsSiteOverviewCardContent />}>
                    <DocsSiteOverviewCardContent docsUrl={docsUrl} orgName={orgName} urls={docsSite.urls} />
                </Suspense>
            </Card>
        </div>
    );
}
