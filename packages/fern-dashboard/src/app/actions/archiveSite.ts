"use server";

import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";
import { getFdrClient } from "../services/fdr/getFdrClient";

export async function archiveSite({ url, orgName }: { url: string; orgName: Auth0OrgName }) {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);
    const fdrClient = getFdrClient({ token: session.accessToken });
    try {
        await fdrClient.docs.v2.write.setIsArchived({
            url: FdrAPI.Url(url),
            isArchived: true
        });
    } catch (e: unknown) {
        console.error("Failed to archive site", e);
        throw new Error("Failed to archive site");
    }
}
