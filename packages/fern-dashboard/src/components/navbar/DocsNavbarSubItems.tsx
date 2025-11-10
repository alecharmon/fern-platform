import "server-only";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { cn } from "@/utils/utils";
import { PosthogFeatureFlag } from "../posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "../posthog/feature-flags/server-side";
import { NavbarSubItem } from "./NavbarSubItem";

export async function DocsNavbarSubItems({
    docsSites,
    orgName
}: {
    docsSites: FdrAPI.dashboard.DocsSite[];
    orgName: Auth0OrgName;
}) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    const isCreateDocsNewSiteEnabled = await isFeatureFlagEnabledForUser(
        PosthogFeatureFlag.ENABLE_CREATE_DOCS_NEW_SITE,
        session?.user.sub,
        orgName
    );
    return (
        <>
            {docsSites.map((docsSite) => {
                const url = getDocsSiteUrl(docsSite);
                const docsUrlParam = constructDocsUrlParam(url);
                return (
                    <NavbarSubItem key={url} title={url} href={`/docs/${docsUrlParam}`} docsUrlParam={docsUrlParam} />
                );
            })}
            <Link
                href={
                    isCreateDocsNewSiteEnabled
                        ? `/${orgName}/docs/new`
                        : "https://buildwithfern.com/learn/docs/getting-started/quickstart"
                }
                className={cn(
                    "hidden md:flex",
                    "flex-1 flex-row gap-2 text-sm transition",
                    "hover:text-primary text-gray-900"
                )}
                target={isCreateDocsNewSiteEnabled ? "_self" : "_blank"}
            >
                <div className="flex w-5 shrink-0 justify-center">
                    <div className="w-px bg-gray-700" />
                </div>
                <div className="flex min-w-0 items-center gap-2 py-2 pr-4">
                    <PlusIcon className="h-4 w-4" />
                    <div className="truncate">Add new site</div>
                </div>
            </Link>
        </>
    );
}
