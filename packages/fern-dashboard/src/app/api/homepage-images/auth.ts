import { NextResponse } from "next/server";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import { getDocsUrlOwner } from "../utils/getDocsUrlMetadata";
import type { MaybeErrorResponse } from "../utils/MaybeErrorResponse";

export async function ensureUserOwnsUrl({ token, url }: { token: string; url: string }): Promise<MaybeErrorResponse> {
    const owner = await getDocsUrlOwner({ url, token });

    const isMember = await getVenusClient({ token }).organization.isMember(owner.orgName);
    if (!isMember.ok) {
        console.error("Failed to load org membership for user", JSON.stringify(isMember.error));
        throw new Error("Failed to load org membership for user");
    }
    if (!isMember.body) {
        return {
            errorResponse: NextResponse.json({ error: "User does not have access to url" }, { status: 403 })
        };
    }

    return { data: undefined };
}

export async function ensureOrgOwnsUrl({
    token,
    url,
    orgName
}: {
    token: string;
    url: string;
    orgName: Auth0OrgName;
}): Promise<MaybeErrorResponse> {
    const owner = await getDocsUrlOwner({ url, token });

    if (owner.orgName !== orgName) {
        console.error(`Org ${orgName} does not own URL ${url} (it is owned by ${owner.orgName})`);
        return {
            errorResponse: NextResponse.json({ message: `Org ${orgName} does not own URL ${url}` }, { status: 401 })
        };
    }
    return { data: undefined };
}
