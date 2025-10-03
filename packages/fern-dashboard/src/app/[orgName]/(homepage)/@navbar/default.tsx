import { Suspense } from "react";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { DocsNavbarItem } from "@/components/navbar/DocsNavbarItem";
import { DocsNavbarItems } from "@/components/navbar/DocsNavbarItems";
import { NavbarItem } from "@/components/navbar/NavbarItem";
import { NavbarSectionTitle } from "@/components/navbar/NavbarSectionTitle";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "@/components/posthog/feature-flags/server-side";

export default async function Navbar({ params }: Readonly<{ params: Promise<{ orgName: Auth0OrgName }> }>) {
    const { orgName } = await params;
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    // Validate organization access, but return null rather than redirect, so that sidebar just doesn't show
    try {
        await assertUserHasOrganizationAccess({
            token: session.accessToken,
            orgName
        });
    } catch (_) {
        return null;
    }

    return (
        <div className="flex h-full w-fit max-w-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] md:w-[var(--sidebar-width)] md:border-0 md:py-6 md:pl-4 md:transition-[width]">
            <div className="flex gap-8 overflow-y-auto px-8 md:flex-col md:gap-0 md:px-0 md:pb-4">
                <Suspense fallback={<DocsNavbarItem />}>
                    <DocsNavbarItems orgName={orgName} />
                </Suspense>
                <FeatureFlaggedServerSide flag={PosthogFeatureFlag.ENABLE_SDKS_PAGE} orgName={orgName}>
                    <NavbarItem title="SDKs" iconType="sdks" href="/sdks" />
                </FeatureFlaggedServerSide>
                <NavbarSectionTitle title="Settings" />
                <NavbarItem title="Members" iconType="members" href="/members" />
                <FeatureFlaggedServerSide flag={PosthogFeatureFlag.ENABLE_API_KEYS_PAGE} orgName={orgName}>
                    <NavbarItem title="API Keys" iconType="api-keys" href="/api-keys" />
                </FeatureFlaggedServerSide>
                <FeatureFlaggedServerSide flag={PosthogFeatureFlag.ENABLE_BILLING_PAGE} orgName={orgName}>
                    <NavbarItem title="Billing" iconType="billing" href="/billing" />
                </FeatureFlaggedServerSide>
            </div>
        </div>
    );
}
