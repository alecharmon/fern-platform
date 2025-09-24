import { notFound, redirect } from "next/navigation";

import * as auth0Management from "@/app/services/auth0/management";
import { throwDigestibleError } from "@/utils/errors";

import { getCurrentSession } from "../auth0/getCurrentSession";
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
  const orgExists = await auth0Management.doesOrgExist(orgName);
  if (!orgExists) {
    throw throwDigestibleError(
      new Error("Organization not found"),
      "ORG_NOT_FOUND"
    );
  }
  try {
    // Check if user belongs to organization
    await auth0Management.ensureUserBelongsToOrg(userId, orgName);
  } catch (error) {
    throw throwDigestibleError(error as Error, "USER_NOT_IN_ORG");
  }
}

export async function getAuthenticatedSessionOrRedirect(orgName: Auth0OrgName) {
  const session = await getCurrentSession();
  if (session == null) {
    redirect("/");
  }
  try {
    await assertUserHasOrganizationAccess({
      userId: session.user.sub,
      orgName,
    });
    return session;
  } catch (_) {
    notFound();
  }
}
