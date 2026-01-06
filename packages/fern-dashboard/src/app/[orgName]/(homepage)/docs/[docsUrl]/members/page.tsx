import { getResourceUsers } from "@fern-api/user-permissions";
import { notFound } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName, getOrgMembers } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";
import { ResourceMembersPage } from "./ResourceMembersPage";

export default async function MembersPage({
    params
}: {
    params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }>;
}) {
    const { orgName, docsUrl: encodedDocsUrl } = await params;
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

    const session = await getCurrentSession();
    if (session == null) {
        return notFound();
    }

    // Check if fine-grained permissions are enabled
    const isFineGrainedPermissionsEnabled = await isFeatureFlagEnabledForUser(
        PosthogFeatureFlag.ENABLE_FINE_GRAINED_PERMISSIONS,
        session.user.sub,
        orgName
    );

    if (!isFineGrainedPermissionsEnabled) {
        return notFound();
    }

    // Get org ID and members
    const orgId = await getOrgIdFromName(orgName);
    const orgMembers = await getOrgMembers(orgName, { includeFernEmployees: true });

    // Get users with access to this docs resource
    let resourceUsers: Awaited<ReturnType<typeof getResourceUsers>> = [];
    try {
        resourceUsers = await getResourceUsers({
            orgId,
            resourceType: "docs",
            resourceId: docsUrl
        });
    } catch (error) {
        console.error("Failed to fetch resource users:", error);
    }

    // Create a map of resource user roles by user ID
    const resourceUserRolesMap = new Map(resourceUsers.map((ru) => [ru.user_id, ru.role]));

    // Map all org members with their resource-specific role (if any)
    const allMembers = orgMembers.map((member) => ({
        userId: member.user_id,
        name: member.name,
        email: member.email,
        picture: member.picture,
        resourceRole: resourceUserRolesMap.get(member.user_id)
    }));

    return (
        <ResourceMembersPage
            docsUrl={docsUrl}
            orgName={orgName}
            members={allMembers}
            currentUserId={session.user.sub}
        />
    );
}
