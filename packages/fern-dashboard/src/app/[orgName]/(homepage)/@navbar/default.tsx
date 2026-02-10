import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { AuthZWrapperServer } from "@/components/auth/authz/AuthZWrapperServer";
import { DocsNavbarItems } from "@/components/navbar/DocsNavbarItems";
import { NavbarCollapseToggle } from "@/components/navbar/NavbarCollapseToggle";
import { NavbarItem } from "@/components/navbar/NavbarItem";
import { NavbarSectionTitle } from "@/components/navbar/NavbarSectionTitle";
import { NavbarWithOverflow } from "@/components/navbar/NavbarWithOverflow";
import { NavbarWrapper } from "@/components/navbar/NavbarWrapper";
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
        await assertUserHasOrganizationAccess(session.accessToken, orgName);
    } catch (_) {
        console.warn("[Navbar] User does not have access to organization: ", orgName);
        return null;
    }

    return (
        <NavbarWrapper>
            <NavbarWithOverflow>
                <DocsNavbarItems orgName={orgName} />
                <FeatureFlaggedServerSide flag={PosthogFeatureFlag.ENABLE_SDKS_PAGE} orgName={orgName}>
                    <NavbarItem title="SDKs" iconType="sdks" href="/sdks" />
                </FeatureFlaggedServerSide>
                <AuthZWrapperServer permission="manage-settings" orgName={orgName}>
                    <NavbarSectionTitle title="Settings" />
                    <FeatureFlaggedServerSide flag={PosthogFeatureFlag.ENABLE_INCIDENTS_PAGE} orgName={orgName}>
                        <NavbarItem title="Incidents" iconType="incidents" href="/incidents" />
                    </FeatureFlaggedServerSide>
                    <NavbarItem title="Members" iconType="members" href="/members" />
                    <FeatureFlaggedServerSide flag={PosthogFeatureFlag.ENABLE_BILLING_PAGE_NEW} orgName={orgName}>
                        <NavbarItem title="Billing" iconType="billing" href="/billing" />
                    </FeatureFlaggedServerSide>
                    <NavbarItem title="General" iconType="settings" href="/settings" />
                    <FeatureFlaggedServerSide flag={PosthogFeatureFlag.ENABLE_API_KEYS_PAGE} orgName={orgName}>
                        <NavbarItem title="API Keys" mobileTitle="Keys" iconType="api-keys" href="/api-keys" />
                    </FeatureFlaggedServerSide>
                </AuthZWrapperServer>
            </NavbarWithOverflow>
            <NavbarCollapseToggle />
        </NavbarWrapper>
    );
}
