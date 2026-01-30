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

    // Check if permissions enforcement is enabled
    let isEnforcePermissionsEnabled = false;
    try {
        isEnforcePermissionsEnabled =
            (await isFeatureFlagEnabledForUser(PosthogFeatureFlag.ENFORCE_PERMISSIONS, session.user.sub, orgName)) ??
            false;
    } catch (error) {
        console.error("Failed to check enforce permissions feature flag", error);
    }

    return (
        <MembersPage
            session={session}
            isFernAdmin={isFernAdmin}
            isFineGrainedPermissionsEnabled={isFineGrainedPermissionsEnabled}
            isEnforcePermissionsEnabled={isEnforcePermissionsEnabled}
        />
    );
}
