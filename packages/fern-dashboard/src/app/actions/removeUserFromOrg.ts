"use server";

import { postToSlack } from "@fern-api/docs-server/slack";

import * as auth0Management from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import type { Auth0OrgName, Auth0UserID } from "../services/auth0/types";
import { assertUserHasOrganizationAccess } from "../services/dal/organization";

export async function removeUserFromOrg({
    userIdToRemove,
    orgName
}: {
    userIdToRemove: Auth0UserID;
    orgName: Auth0OrgName;
}) {
    const auth0 = auth0Management.getAuth0ManagementClient();
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const isFernEmployee = await auth0Management.createIsFernEmployee();

    if (!isFernEmployee(userId) && isFernEmployee(userIdToRemove)) {
        throw new Error("Non-fern-employee cannot remove fern-employee");
    }

    const removedUser = await auth0.users.get({ id: userIdToRemove });

    await auth0.organizations.deleteMembers(
        { id: await auth0Management.getOrgIdFromName(orgName) },
        { members: [userIdToRemove] }
    );

    await auth0Management.invalidateCachesAfterAddingOrRemovingOrgMember({
        orgName
    });

    const actorName = session.user.name ?? session.user.email ?? userId;
    const removedUserName = removedUser.data.name ?? removedUser.data.email ?? userIdToRemove;
    const removedUserEmail = removedUser.data.email ?? "unknown";

    postToSlack(
        "#dashboard-notifs",
        `*[${orgName}]* ${actorName} removed ${removedUserName} (${removedUserEmail}) from the organization`,
        "org-member-change"
    );
}
