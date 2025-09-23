"use server";

import { revalidateTag } from "next/cache";

import { ensureUserBelongsToOrgCacheTag } from "../services/auth0/management";
import { Auth0OrgName, Auth0UserID } from "../services/auth0/types";
import { getAvailableOrgsForUserCacheTag } from "../services/dal/fdr/getAvailableOrgsForUser";

export async function revalidateInviteAcceptance({
  userId,
  orgName,
}: {
  userId: Auth0UserID;
  orgName: Auth0OrgName;
}) {
  try {
    // Invalidate the cache for the user's available organizations and org access
    revalidateTag(getAvailableOrgsForUserCacheTag(userId));
    revalidateTag(ensureUserBelongsToOrgCacheTag(userId, orgName));
  } catch (error) {
    console.error("Failed to revalidate tags", error);
  }
}
