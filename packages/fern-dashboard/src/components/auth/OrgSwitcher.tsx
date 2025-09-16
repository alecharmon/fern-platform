import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getAvailableOrgsForUser from "@/app/services/dal/fdr/getAvailableOrgsForUser";

import { OrgSwitcherClient } from "./OrgSwitcherClient";

export async function OrgSwitcher({
  currentOrgName,
}: {
  currentOrgName: Auth0OrgName;
}) {
  const session = await getCurrentSession();
  if (session == null) {
    return null;
  }
  const organizations = await getAvailableOrgsForUser({
    userId: session.user.sub,
  });

  return (
    <OrgSwitcherClient
      organizations={organizations}
      currentOrgName={currentOrgName}
    />
  );
}
