import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { isFernEmployee } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsSiteNavBarItem } from "@/components/docs-page/DocsSiteNavBarItem";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "@/components/posthog/feature-flags/server-side";

export default async function DocsSiteNavbar({
  params,
}: Readonly<{ params: Promise<{ orgName: Auth0OrgName }> }>) {
  const { orgName } = await params;

  const session = await getCurrentSession();
  if (session == null) {
    return null;
  }

  const isEmployee = await isFernEmployee(session.user.sub);
  return (
    <div className="flex">
      <DocsSiteNavBarItem title="Overview" href="" />
      <DocsSiteNavBarItem title="Web Analytics" href="web-analytics" />
      <FeatureFlaggedServerSide
        flag={PosthogFeatureFlag.ENABLE_DOCS_ASK_FERN_TAB}
        orgName={orgName}
      >
        <DocsSiteNavBarItem title="Ask Fern" href="ask-fern" />
      </FeatureFlaggedServerSide>
      {isEmployee && <DocsSiteNavBarItem title="Settings" href="settings" />}
    </div>
  );
}
