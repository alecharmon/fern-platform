"use server";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";
import { getFdrLambdaClient } from "../services/fdr/getFdrLambdaClient";

export async function deleteDocsSite({ url, orgName }: { url: string; orgName: Auth0OrgName }) {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess({
        token: session.accessToken,
        orgName
    });

    const client = getFdrLambdaClient({ token: session.accessToken });
    const response = await client.docs.v2.write.deleteDocsSite({ url });
    if (!response.ok) {
        console.error("Failed to delete site", JSON.stringify(response.error));
        throw new Error("Failed to delete site");
    }
}
