import { getEmailLoginConfig } from "@fern-docs/edge-config";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { isFernEmployee } from "@/app/services/auth0/management";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { MembersPage } from "@/components/members/MembersPage";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";

export default async function Page({ params }: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const { orgName } = await params;
    const session = await getCurrentSession();
    if (session == null) {
        return await redirectToLogin();
    }
    const isFernAdmin = isFernEmployee(session.permissions ?? []);

    // Check if fine-grained permissions feature flag is enabled
    let isFineGrainedPermissionsEnabled = false;
    try {
        isFineGrainedPermissionsEnabled =
            (await isFeatureFlagEnabledForUser(
                PosthogFeatureFlag.ENABLE_FINE_GRAINED_PERMISSIONS,
                session.user.sub,
                orgName
            )) ?? false;
    } catch (error) {
        console.error("Failed to check fine-grained permissions feature flag", error);
    }

    // Check if org uses OIDC group mappings via edge config
    let useGroupMappings = false;
    try {
        const emailLoginConfig = await getEmailLoginConfig();
        console.error("ORG NAME", orgName);
        
        useGroupMappings = Object.values(emailLoginConfig.connectionToOrg).some(
            (entry) => entry.org_name === orgName && entry.use_group_mappings
        );
    } catch (error) {
        console.error("Failed to check group mappings config", error);
    }

    return (
        <MembersPage
            session={session}
            isFernAdmin={isFernAdmin}
            isFineGrainedPermissionsEnabled={isFineGrainedPermissionsEnabled}
            useGroupMappings={useGroupMappings}
        />
    );
}
