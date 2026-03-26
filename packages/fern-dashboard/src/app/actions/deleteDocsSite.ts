"use server";

import { revalidateTag } from "next/cache";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";
import { getFdrClient } from "../services/fdr/getFdrClient";

export async function deleteDocsSite({ url, orgName }: { url: string; orgName: Auth0OrgName }) {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const fdrClient = getFdrClient({ token: session.accessToken });
    try {
        await fdrClient.docs.v2.write.deleteDocsSite({ url });
    } catch (e: unknown) {
        console.error("Failed to delete site", e);
        throw new Error("Failed to delete site");
    }

    // Revalidate cached docs sites list and related caches after deletion
    revalidateTag(`docs-sites:${orgName}`, "default");
    revalidateTag(`git-url:${url}`, "default");
    revalidateTag(`ask-ai:${url}`, "default");
}
