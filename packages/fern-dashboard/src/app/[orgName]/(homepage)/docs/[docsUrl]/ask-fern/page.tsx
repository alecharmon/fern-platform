import { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import AnalyticsPage from "@/components/analytics/AnalyticsPage";
import { AskAiEnabledServerSide } from "@/components/ask-ai/AskAiEnabledServerSide";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";

export default async function Page(props: {
  params: Promise<{ orgName: Auth0OrgName; docsUrl: string }>;
}) {
  const params = await props.params;
  const session = await getAuthenticatedSessionOrRedirect(params.orgName);

  const analyticsBillingEnabled = await isFeatureFlagEnabledForUser(
    PosthogFeatureFlag.ENABLE_DOCS_ASK_FERN_BILLING,
    session.user.sub,
    params.orgName
  );

  return (
    <AskAiEnabledServerSide
      docsUrl={params.docsUrl}
      orgName={params.orgName}
      redirectWhenDisabled={true}
    >
      <AnalyticsPage
        docsUrl={params.docsUrl}
        analyticsBillingEnabled={analyticsBillingEnabled ?? false}
      />
    </AskAiEnabledServerSide>
  );
}
