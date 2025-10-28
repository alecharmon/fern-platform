"use server";

import * as auth0Management from "@/app/services/auth0/management";

import { getAuth0ClientId } from "../services/auth0/auth0";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getAuth0ManagementClient } from "../services/auth0/management";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

export async function inviteUserToOrg({ inviteeEmail, orgName }: { inviteeEmail: string; orgName: Auth0OrgName }) {
    const auth0 = getAuth0ManagementClient();
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const invitation = await auth0.organizations.createInvitation(
        { id: await auth0Management.getOrgIdFromName(orgName) },
        {
            inviter: { name: session.user.name ?? "" },
            invitee: { email: inviteeEmail },
            client_id: getAuth0ClientId(),
            send_invitation_email: true
        }
    );

    return {
        invitationId: invitation.data.id
    };
}
