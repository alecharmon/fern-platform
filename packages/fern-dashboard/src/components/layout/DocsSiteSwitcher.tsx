import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";

import { DocsSiteSelect } from "./DocsSiteSelect";

export async function DocsSiteSwitcher({
  orgName,
  docsUrl,
}: Readonly<{ orgName: Auth0OrgName; docsUrl?: string }>) {
  const session = await getCurrentSession();
  if (session == null) {
    return null;
  }

  const { docsSites } = await getDocsSitesForOrg({
    orgName,
    token: session.accessToken,
  });

  return (
    <DocsSiteSelect
      docsSites={docsSites}
      currentDocsUrl={
        docsUrl != null ? parseDocsUrlParam({ docsUrl: docsUrl }) : undefined
      }
    />
  );
}
