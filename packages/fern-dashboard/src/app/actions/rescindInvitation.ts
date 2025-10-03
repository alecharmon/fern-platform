"use server";

import * as auth0Management from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getAuth0ManagementClient } from "../services/auth0/management";
import { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

export async function rescindInvitation({ invitationId, orgName }: { invitationId: string; orgName: Auth0OrgName }) {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess({
        token: session.accessToken,
        orgName
    });

    const auth0 = getAuth0ManagementClient();
    await auth0.organizations.deleteInvitation({
        id: await auth0Management.getOrgIdFromName(orgName),
        invitation_id: invitationId
    });
}
