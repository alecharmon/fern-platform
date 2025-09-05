import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import AnalyticsPage from "@/components/analytics/AnalyticsPage";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import {
  FeatureFlaggedServerSide,
  isFeatureFlagEnabledForUser,
} from "@/components/posthog/feature-flags/server-side";

export default async function Page(props: {
  params: Promise<{ orgName: Auth0OrgName; docsUrl: string }>;
}) {
  const params = await props.params;
  const session = await getCurrentSessionOrThrow();
  const analyticsBillingEnabled = await isFeatureFlagEnabledForUser(
    PosthogFeatureFlag.ENABLE_DOCS_ASK_FERN_BILLING,
    session.user.sub,
    params.orgName
  );

  return (
    <FeatureFlaggedServerSide
      flag={PosthogFeatureFlag.ENABLE_DOCS_ASK_FERN_TAB}
      redirectWhenDisabled
      orgName={params.orgName}
    >
      <AnalyticsPage
        docsUrl={params.docsUrl}
        analyticsBillingEnabled={analyticsBillingEnabled ?? false}
      />
    </FeatureFlaggedServerSide>
  );
}
