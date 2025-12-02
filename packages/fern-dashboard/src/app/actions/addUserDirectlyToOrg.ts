"use server";

import { postToSlack } from "@fern-api/docs-server/slack";

import * as auth0Management from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName, Auth0UserID } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

export type AddUserDirectlyResult =
    | { ok: true; userId: Auth0UserID; userEmail: string }
    | { ok: false; code: "user_not_found" | "not_admin" | "no_org_access"; message: string };

export async function addUserDirectlyToOrg({
    email,
    orgName
}: {
    email: string;
    orgName: Auth0OrgName;
}): Promise<AddUserDirectlyResult> {
    const session = await getCurrentSessionOrThrow();

    const isFernAdmin = await auth0Management.isFernEmployee(session.user.sub);
    if (!isFernAdmin) {
        return {
            ok: false,
            code: "not_admin",
            message: "Only Fern employees can add users directly to organizations."
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

    const actorName = session.user.name ?? session.user.email ?? session.user.sub;

    postToSlack(
        "#dashboard-notifs",
        `*[${orgName}]* *<mailto:${email}|${email}>* was added to organization by ${actorName} (direct add)`,
        "org-member-change"
    );

    return {
        ok: true,
        userId,
        userEmail: email
    };
}
