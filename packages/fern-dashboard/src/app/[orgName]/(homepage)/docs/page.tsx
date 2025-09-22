import { redirect } from "next/navigation";

import { FdrAPI } from "@fern-api/fdr-sdk";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { DocsZeroState } from "@/components/docs-page/DocsZeroState";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";

export default async function Page({
  params,
}: {
  params: Promise<{ orgName: Auth0OrgName }>;
}) {
  const { orgName } = await params;
  const session = await getCurrentSession();
  if (session == null) {
    redirect("/login");
  }

  // Wrap this in a try/catch to not crash the page if docs sites are not found
  let docsSites: FdrAPI.dashboard.DocsSite[] = [];
  try {
    const response = await getDocsSitesForOrg({
      orgName,
      token: session.accessToken,
    });
    if (response.docsSites != null) {
      docsSites = response.docsSites;
    }
  } catch (error) {
    console.error("Failed to load docs sites", error);
  }

  const firstDocsSite = docsSites[0];
  if (firstDocsSite != null) {
    redirect(
      `/${orgName}/docs/${constructDocsUrlParam(getDocsSiteUrl(firstDocsSite))}`
    );
  }

  return <DocsZeroState user={session.user} />;
}
