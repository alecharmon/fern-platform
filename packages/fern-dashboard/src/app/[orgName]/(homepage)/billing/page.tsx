import { isSuperUser } from "@fern-api/user-permissions";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "@/components/posthog/feature-flags/server-side";
import { BillingInfo } from "@/components/settings/BillingInfo";

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const { orgName } = await props.params;
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/");
    }
    const showSuperUserPricing = isSuperUser(session.permissions ?? []);
    return (
        <FeatureFlaggedServerSide
            flag={PosthogFeatureFlag.ENABLE_BILLING_PAGE_NEW}
            redirectWhenDisabled
            redirectTo={`/${orgName}/settings`}
            orgName={orgName}
        >
            <div className="flex flex-1 flex-col items-center">
                <BillingInfo session={session} showSuperUserPricing={showSuperUserPricing} />
            </div>
        </FeatureFlaggedServerSide>
    );
}
