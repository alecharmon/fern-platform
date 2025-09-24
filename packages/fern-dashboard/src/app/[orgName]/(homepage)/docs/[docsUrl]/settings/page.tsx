import {
  FERN_ORG_NAME,
  ensureUserBelongsToOrg,
} from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { Settings } from "@/components/settings/Settings";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { EncodedDocsUrl } from "@/utils/types";

export default async function Page({
  params,
}: {
  params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }>;
}) {
  const { orgName, docsUrl: encodedDocsUrl } = await params;
  const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

  const session = await getAuthenticatedSessionOrRedirect(orgName);

  let hasFernEmail = false;
  try {
    await ensureUserBelongsToOrg(session.user.sub, FERN_ORG_NAME);
    hasFernEmail = true;
  } catch (error) {
    console.error("Failed to check if user has Fern email:", error);
    hasFernEmail = false;
  }
  return (
    <Settings docsUrl={docsUrl} hasFernEmail={hasFernEmail} orgName={orgName} />
  );
}
