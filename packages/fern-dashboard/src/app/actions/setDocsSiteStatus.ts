"use server";

import type { DocsDeploymentStatus } from "@fern-api/fdr-sdk/orpc-client";
import { revalidateTag, unstable_cache } from "next/cache";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";
import { getOrpcFdrClient } from "../services/fdr/getFdrClient";

function getDocsSiteStatusCacheTag(domain: string, basepath?: string): string {
    return `docs-site-status-${domain}-${basepath ?? ""}`;
}

export async function setDocsSiteStatus({
    domain,
    orgName,
    basepath,
    status
}: {
    domain: string;
    orgName: Auth0OrgName;
    basepath?: string;
    status: DocsDeploymentStatus;
}) {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const fdr = getOrpcFdrClient({ token: session.accessToken });

    try {
        const result = await fdr.docsDeployment.setDocsStatus({
            domain,
            orgId: orgName,
            basepath,
            status
        });

        // Invalidate the cached status so the header badge updates immediately
        revalidateTag(getDocsSiteStatusCacheTag(domain, basepath), "default");

        return { ok: true as const, status: result.status };
    } catch (error) {
        console.error("Failed to set docs site status", error);
        throw new Error("Failed to set docs site status");
    }
}

export async function getDocsSiteStatus({
    domain,
    orgName,
    basepath
}: {
    domain: string;
    orgName: Auth0OrgName;
    basepath?: string;
}): Promise<DocsDeploymentStatus | null> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const fdr = getOrpcFdrClient({ token: session.accessToken });

    const tag = getDocsSiteStatusCacheTag(domain, basepath);

    const fetchStatus = async (): Promise<DocsDeploymentStatus | null> => {
        try {
            const result = await fdr.docsDeployment.getDocsStatus({
                domain,
                orgId: orgName,
                basepath
            });
            return result.status;
        } catch (error) {
            console.error("Failed to get docs site status", error);
            return null;
        }
    };

    return unstable_cache(fetchStatus, [`docs-site-status-${domain}-${basepath ?? ""}-${orgName}`], {
        revalidate: 60 * 5, // 5 minutes
        tags: [tag]
    })();
}
