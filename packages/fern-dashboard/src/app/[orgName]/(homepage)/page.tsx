import { redirect } from "next/navigation";

import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";

import { getCurrentSession } from "../../services/auth0/getCurrentSession";
import { Auth0OrgName } from "../../services/auth0/types";

export default async function Page({
  params,
}: {
  params: Promise<{ orgName: Auth0OrgName }>;
}) {
  const session = await getCurrentSession();

  if (session == null) {
    redirect("/login");
  }

  const { orgName } = await params;

  const isDocsPageEnabled = await isFeatureFlagEnabledForUser(
    PosthogFeatureFlag.ENABLE_DOCS_PAGE,
    session.user.sub,
    orgName
  );

  if (isDocsPageEnabled) {
    redirect(`/${orgName}/docs`);
  } else {
    redirect(`/${orgName}/members`);
  }
}
