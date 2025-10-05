import type { Auth0OrgName } from "@/app/services/auth0/types";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "@/components/posthog/feature-flags/server-side";

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const { orgName } = await props.params;
    return (
        <FeatureFlaggedServerSide flag={PosthogFeatureFlag.ENABLE_API_KEYS_PAGE} redirectWhenDisabled orgName={orgName}>
            <div>api keys!</div>
        </FeatureFlaggedServerSide>
    );
}
