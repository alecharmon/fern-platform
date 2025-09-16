import "server-only";

import { Auth0UserID } from "@/app/services/auth0/types";

import { getMyOrganizations } from "../../auth0/management";

export default async function getAvailableOrgsForUser({
  userId,
}: {
  userId: Auth0UserID;
}) {
  "use cache";
  return await getMyOrganizations(userId);
}
