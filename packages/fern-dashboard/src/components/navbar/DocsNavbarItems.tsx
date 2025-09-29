import "server-only";

import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";

import { DocsNavbarItem } from "./DocsNavbarItem";
import { DocsNavbarSubItems } from "./DocsNavbarSubItems";

export async function DocsNavbarItems({ orgName }: { orgName: Auth0OrgName }) {
  const session = await getCurrentSession();
  if (session == null) {
    return null;
  }

  await getAuthenticatedSessionOrRedirect(orgName);

  const response = await getDocsSitesForOrg({
    orgName,
    token: session.accessToken,
  });
  if (!response.ok) {
    console.warn(
      "Failed to get docs sites for org: ",
      JSON.stringify(response.error, null, 2)
    );
    return null;
  }

  const docsSites: FdrAPI.dashboard.DocsSite[] = response.docsSites;
  const firstDocsSite: FdrAPI.dashboard.DocsSite | undefined = docsSites[0];

  return (
    <>
      <DocsNavbarItem
        hrefForActualLinking={
          firstDocsSite != null
            ? `/docs/${constructDocsUrlParam(getDocsSiteUrl(firstDocsSite))}`
            : undefined
        }
      />
      <DocsNavbarSubItems docsSites={docsSites} />
    </>
  );
}
