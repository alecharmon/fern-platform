"use server";

import { postToSlack } from "@fern-api/docs-server/slack";

import * as auth0Management from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

export async function addUserDirectlyToOrg({ email, orgName }: { email: string; orgName: Auth0OrgName }) {
    const session = await getCurrentSessionOrThrow();

    const isFernAdmin = await auth0Management.isFernEmployee(session.user.sub);
    if (!isFernAdmin) {
        throw new Error("Only Fern employees can add users directly to organizations");
    }

    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const userId = await auth0Management.getUserIdByEmail(email);

    await auth0Management.addUserToOrg(userId, orgName);

    const actorName = session.user.name ?? session.user.email ?? session.user.sub;

    postToSlack(
        "#dashboard-notifs",
        `*[${orgName}]* ${actorName} added ${email} to the organization (direct add)`,
        "org-member-change"
    );

    return {
        userId,
        userEmail: email
    };
}
