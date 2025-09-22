import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createPersonalProject } from "./actions/createPersonalProject";
import {
  Auth0SessionData,
  getCurrentSession,
} from "./services/auth0/getCurrentSession";
import { getMyOrganizations } from "./services/auth0/management";
import { Auth0OrgName } from "./services/auth0/types";

export default async function Page() {
  const session = await getCurrentSession();

  if (session == null) {
    redirect("/login");
  }

  // Check if there's a pending org redirect from invitation flow
  const cookieStore = await cookies();
  const pendingOrgRedirect = cookieStore.get("pending_org_redirect")?.value;

  if (pendingOrgRedirect) {
    // Redirect to the invited organization (cookie will be cleared by middleware on next request)
    redirect(`/${pendingOrgRedirect}`);
  }

  const firstOrg = await getOrCreateFirstOrgForUser(session);
  redirect(`/${firstOrg.orgName}/docs`);
}

async function getOrCreateFirstOrgForUser(
  session: Auth0SessionData
): Promise<{ orgName: Auth0OrgName }> {
  const organizations = await getMyOrganizations(session.user.sub);
  const firstOrg = organizations[0];
  if (firstOrg != null) {
    return {
      orgName: Auth0OrgName(firstOrg.name),
    };
  }

  const personalProject = await createPersonalProject();
  return {
    orgName: personalProject.orgName,
  };
}
