import "server-only";

import { unstable_cacheTag } from "next/cache";

import { Auth0UserID } from "@/app/services/auth0/types";

import { getMyOrganizations } from "../../auth0/management";

export const getAvailableOrgsForUserCacheTag = (userId: Auth0UserID) =>
  `available-orgs-for-user-${userId}`;

export default async function getAvailableOrgsForUser({
  userId,
}: {
  userId: Auth0UserID;
}) {
  "use cache";
  unstable_cacheTag(getAvailableOrgsForUserCacheTag(userId));
  return await getMyOrganizations(userId);
}
