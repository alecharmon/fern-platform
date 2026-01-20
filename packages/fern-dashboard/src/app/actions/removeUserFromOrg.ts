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

    // Check if current user is a super user
    const isCurrentUserSuperUser = auth0Management.isSuperUser(session.permissions ?? []);
    // For the user being removed, we check Fern org membership since we can't access their permissions
    const isFernOrgMemberChecker = await auth0Management.createIsFernOrgMemberChecker();

    if (!isCurrentUserSuperUser && isFernOrgMemberChecker(userIdToRemove)) {
        throw new Error("Non-super-user cannot remove Fern organization member");
    }

    const removedUser = await auth0.users.get({ id: userIdToRemove });

    await auth0.organizations.deleteMembers(
        { id: await auth0Management.getOrgIdFromName(orgName) },
        { members: [userIdToRemove] }
    );

    await auth0Management.invalidateCachesAfterRemovingOrgMember(userIdToRemove, orgName);

    const actorName = session.user.name ?? session.user.email ?? userId;
    const removedUserEmail = removedUser.data.email ?? "unknown";

    postToSlack(
        "#dashboard-notifs",
        `*[${orgName}]* *<mailto:${removedUserEmail}|${removedUserEmail}>* was removed from organization by ${actorName}`,
        "org-member-change"
    );
}
