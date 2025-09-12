import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import {
  FERN_ORG_NAME,
  ensureUserBelongsToOrg,
} from "@/app/services/auth0/management";
import { Settings } from "@/components/settings/Settings";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { EncodedDocsUrl } from "@/utils/types";

export default async function Page({
  params,
}: {
  params: Promise<{ docsUrl: EncodedDocsUrl }>;
}) {
  const docsUrl = parseDocsUrlParam(await params);

  const session = await getCurrentSession();
  let hasFernEmail = false;
  try {
    if (session) {
      await ensureUserBelongsToOrg(session.user.sub, FERN_ORG_NAME);
      hasFernEmail = true;
    }
  } catch (error) {
    console.error("Failed to check if user has Fern email:", error);
    hasFernEmail = false;
  }
  return <Settings docsUrl={docsUrl} hasFernEmail={hasFernEmail} />;
}
