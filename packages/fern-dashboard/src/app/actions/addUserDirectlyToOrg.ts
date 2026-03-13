"use server";

import { postToSlack } from "@fern-api/docs-server/slack";
import { addRoles, type Roles } from "@fern-api/user-permissions";
import { revalidateTag } from "next/cache";

import * as auth0Management from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName, Auth0UserID } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

export type AddUserDirectlyResult =
    | { ok: true; userId: Auth0UserID; userEmail: string }
    | { ok: false; code: "user_not_found" | "not_admin" | "no_org_access"; message: string };

export async function addUserDirectlyToOrg({
    email,
    orgName,
    roles = ["viewer"]
}: {
    email: string;
    orgName: Auth0OrgName;
    roles?: Roles[];
}): Promise<AddUserDirectlyResult> {
    const session = await getCurrentSessionOrThrow();

    const isFernAdmin = auth0Management.isFernEmployee(session.permissions ?? []);
    if (!isFernAdmin) {
        return {
            ok: false,
            code: "not_admin",
            message: "Only super users can add users directly to organizations."
        };
    }

    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName);
    } catch {
        return {
            ok: false,
            code: "no_org_access",
            message: "You do not have access to this organization."
        };
    }

    let userId: Auth0UserID;
    try {
        userId = await auth0Management.getUserIdByEmail(email);
    } catch (err) {
        if (err instanceof Error && err.message.includes("No user found with email")) {
            return {
                ok: false,
                code: "user_not_found",
                message: `No Fern account found for ${email}. Try sending an email invite instead.`
            };
        }
        throw err;
    }

    await auth0Management.addUserToOrg(userId, orgName);

    // Assign roles to the user
    const orgId = await auth0Management.getOrgIdFromName(orgName);
    await addRoles({ userId, orgId, roleNames: roles });

    // Invalidate the Next.js cached permission check so the new member
    // sees the correct access level without waiting for the cache TTL.
    revalidateTag(`permissions:${orgName}:${userId}`);

    const actorName = session.user.name ?? session.user.email ?? session.user.sub;

    postToSlack(
        "#dashboard-notifs",
        `*[${orgName}]* *<mailto:${email}|${email}>* was added to organization with roles [${roles.join(", ")}] by ${actorName} (direct add)`,
        "org-member-change"
    );

    return {
        ok: true,
        userId,
        userEmail: email
    };
}
