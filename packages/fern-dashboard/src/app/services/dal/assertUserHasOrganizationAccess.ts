import jwt from "jsonwebtoken";

import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { throwDigestibleError } from "@/utils/errors";

import { getVenusClient } from "../venus/getVenusClient";

function getTokenForVenus(sessionToken: string): string | undefined {
    const decodedToken = jwt.decode(sessionToken) as any;
    const permissions: string[] = decodedToken?.permissions ?? [];
    if (auth0Management.isSuperUser(permissions)) {
        return undefined;
    }
    return sessionToken;
}

export async function assertUserHasOrganizationAccess(token: string, orgName: Auth0OrgName): Promise<void> {
    const orgExists = await auth0Management.doesOrgExist(orgName);
    if (!orgExists) {
        throw throwDigestibleError(new Error("Organization not found"), "ORG_NOT_FOUND");
    }

    const venusToken = getTokenForVenus(token);
    if (venusToken == null) {
        return;
    }

    const venusClient = getVenusClient({ token: venusToken });
    const result = await venusClient.organization.isMember(orgName);
    if (!result.ok || !result.body) {
        throw throwDigestibleError(new Error("user not in org"), "USER_NOT_IN_ORG");
    }
}
