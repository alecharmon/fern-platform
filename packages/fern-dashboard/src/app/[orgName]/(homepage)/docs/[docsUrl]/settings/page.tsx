import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
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
  const hasFernEmail =
    session?.user.email?.endsWith("@buildwithfern.com") ?? false;
  return <Settings docsUrl={docsUrl} hasFernEmail={hasFernEmail} />;
}
