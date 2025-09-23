"use server";

import { revalidateTag } from "next/cache";

import * as auth0Management from "@/app/services/auth0/management";
import { ensureUserBelongsToOrgCacheTag } from "@/app/services/auth0/management";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { Auth0OrgName, Auth0UserID } from "../services/auth0/types";
import { getAvailableOrgsForUserCacheTag } from "../services/dal/fdr/getAvailableOrgsForUser";

export async function removeUserFromOrg({
  userIdToRemove,
  orgName,
}: {
  userIdToRemove: Auth0UserID;
  orgName: Auth0OrgName;
}) {
  const auth0 = auth0Management.getAuth0ManagementClient();
  const session = await getCurrentSessionOrThrow();
  const userId = session.user.sub;

  await auth0Management.ensureUserBelongsToOrg(userId, orgName);

  if (userId === userIdToRemove) {
    throw new Error("User cannot remove themself");
  }

  const isFernEmployee = await auth0Management.createIsFernEmployee();

  if (!isFernEmployee(userId) && isFernEmployee(userIdToRemove)) {
    throw new Error("Non-fern-employee cannot remove fern-employee");
  }

  await auth0.organizations.deleteMembers(
    { id: await auth0Management.getOrgIdFromName(orgName) },
    { members: [userIdToRemove] }
  );

  await auth0Management.invalidateCachesAfterAddingOrRemovingOrgMember({
    orgName,
  });

  // Revalidate the cache for the user's available organizations and org access
  revalidateTag(getAvailableOrgsForUserCacheTag(userIdToRemove));
  revalidateTag(ensureUserBelongsToOrgCacheTag(userIdToRemove, orgName));
}
