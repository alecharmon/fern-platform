"use server";

import { addRoles, type Roles } from "@fern-api/user-permissions";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import * as auth0Management from "../services/auth0/management";
import { type Auth0OrgName, Auth0UserID } from "../services/auth0/types";

export type RedeemInviteTokenErrors =
    | { type: "NOT_LOGGED_IN" }
    | { type: "INVITE_TOKEN_NOT_FOUND" }
    | { type: "EXPIRED_INVITE_TOKEN" };

export async function redeemInviteToken({
    token
}: {
    token: string;
}): Promise<
    { success: true; orgName: Auth0OrgName; userId: Auth0UserID } | { success: false; error: RedeemInviteTokenErrors }
> {
    let userId: Auth0UserID;
    let permissions: string[] = [];
    try {
        const session = await getCurrentSessionOrThrow();
        userId = Auth0UserID(session.user.sub);
        permissions = session.permissions ?? [];
    } catch (_) {
        return { success: false, error: { type: "NOT_LOGGED_IN" } };
    }

    // Get the invite token from cache
    const inviteToken = await auth0Management.getInviteToken(token);

    if (!inviteToken) {
        return {
            success: false,
            error: { type: "INVITE_TOKEN_NOT_FOUND" }
        };
    }

    // Check if token has expired
    if (new Date() > new Date(inviteToken.expiresAt)) {
        // Clean up expired token
        await auth0Management.invalidateCachesAfterRedeemingInviteToken(token);
        return {
            success: false,
            error: { type: "EXPIRED_INVITE_TOKEN" }
        };
    }

    // Check if user is already a member
    if (await auth0Management.doesUserBelongToOrg(userId, inviteToken.orgName, { permissions })) {
        // Clean up the token since it's been used
        await auth0Management.invalidateCachesAfterRedeemingInviteToken(token);
        return { success: true, orgName: inviteToken.orgName, userId };
    }

    // Add user to organization
    await auth0Management.addUserToOrg(userId, inviteToken.orgName);

    // Assign roles if specified
    if (inviteToken.roles && inviteToken.roles.length > 0) {
        const orgId = await auth0Management.getOrgIdFromName(inviteToken.orgName);
        await addRoles({ userId, orgId, roleNames: inviteToken.roles as Roles[] });
    }

    // Clean up the token since it's been used (one-time use)
    await auth0Management.invalidateCachesAfterRedeemingInviteToken(token);

    // Redirect to organization
    return { success: true, orgName: inviteToken.orgName, userId };
}
