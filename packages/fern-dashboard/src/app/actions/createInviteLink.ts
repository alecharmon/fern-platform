"use server";

import { getAppUrlServerSide } from "@/utils/getAppUrlServerSide";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { createInviteToken } from "../services/auth0/management";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

export type InviteLinkRole = "admin" | "editor" | "viewer" | "cli";

export async function createInviteLink({ orgName, roles }: { orgName: Auth0OrgName; roles?: InviteLinkRole[] }) {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const { token, expiresAt } = await createInviteToken(orgName, session.user.sub, roles);

    // Generate the invite URL using the current host
    const baseUrl = await getAppUrlServerSide();
    const inviteUrl = `${baseUrl}/accept-invite/${token}`;

    return {
        token,
        inviteUrl,
        expiresAt
    };
}
