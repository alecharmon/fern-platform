import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName, Auth0Organization } from "@/app/services/auth0/types";
import getAvailableOrgsForUser from "@/app/services/dal/fdr/getAvailableOrgsForUser";

import { OrgSwitcherClient } from "./OrgSwitcherClient";

export async function OrgSwitcher({
  currentOrgName,
}: {
  currentOrgName?: Auth0OrgName;
}) {
  const session = await getCurrentSession();
  if (session == null) {
    return null;
  }
  let organizations: Auth0Organization[] = [];
  try {
    organizations = await getAvailableOrgsForUser({
      userId: session.user.sub,
    });
  } catch (error) {
    console.error("Failed to load organizations", error);
    return null;
  }

  return (
    <OrgSwitcherClient
      organizations={organizations}
      currentOrgName={currentOrgName}
    />
  );
}
