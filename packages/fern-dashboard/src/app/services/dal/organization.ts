import * as auth0Management from "@/app/services/auth0/management";
import { throwDigestibleError } from "@/utils/errors";

import { Auth0OrgName, Auth0UserID } from "../auth0/types";

/**
 * Asserts that the user has access to a given auth0 organization.
 *
 * @throws {DigestibleError} if the user does not have access to the organization
 */
export async function assertUserHasOrganizationAccess({
  userId,
  orgName,
}: {
  userId: Auth0UserID;
  orgName: Auth0OrgName;
}) {
  try {
    // Check if user belongs to organization
    await auth0Management.ensureUserBelongsToOrg(userId, orgName);
  } catch (error) {
    throw throwDigestibleError(error as Error, "USER_NOT_IN_ORG");
  }
}
