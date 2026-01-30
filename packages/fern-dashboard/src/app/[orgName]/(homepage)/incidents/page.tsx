import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { CreateIncidentPage } from "@/components/incidents/CreateIncidentPage";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "@/components/posthog/feature-flags/server-side";

export default async function Page({ params }: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const { orgName } = await params;
    const session = await getCurrentSession();

    if (session == null) {
        return await redirectToLogin();
    }

    return (
        <FeatureFlaggedServerSide
            flag={PosthogFeatureFlag.ENABLE_INCIDENTS_PAGE}
            redirectWhenDisabled
            orgName={orgName}
        >
            <CreateIncidentPage />
        </FeatureFlaggedServerSide>
    );
}
