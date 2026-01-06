import { getAllUserScopedPermissions } from "@fern-api/user-permissions";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";

export declare namespace getAuthZPermissions {
    /**
     * Returns session auth info including user ID, org name, permissions, and feature flags.
     * Permissions include both org-level permissions and scoped resource permissions
     * in the format `permission:resourceType:resourceId`.
     */
    export interface Response {
        userId: Auth0UserID | undefined;
        orgName: Auth0OrgName | undefined;
        permissions: string[];
        isFineGrainedPermissionsEnabled: boolean;
        isEnforcePermissions: boolean;
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgName: Auth0OrgName }> }) {
    const sessionData = await getCurrentSession();
    const { orgName } = await params;

    try {
        if (!sessionData) {
            return NextResponse.json({
                userId: undefined,
                orgName: undefined,
                permissions: [],
                isFineGrainedPermissionsEnabled: false,
                isEnforcePermissions: false
            });
        }

        // Check feature flags for this user/org
        let isFineGrainedPermissionsEnabled = false;
        let isEnforcePermissions = false;
        if (orgName) {
            try {
                const [enableFlag, enforceFlag] = await Promise.all([
                    isFeatureFlagEnabledForUser(
                        PosthogFeatureFlag.ENABLE_FINE_GRAINED_PERMISSIONS,
                        sessionData.user.sub,
                        orgName
                    ),
                    isFeatureFlagEnabledForUser(PosthogFeatureFlag.ENFORCE_PERMISSIONS, sessionData.user.sub, orgName)
                ]);
                isFineGrainedPermissionsEnabled = enableFlag ?? false;
                isEnforcePermissions = enforceFlag ?? false;
            } catch (error) {
                console.error("Failed to check permissions feature flags", error);
            }
        }

        // Use centralized function to build all permissions (org-level + resource-scoped)
        let permissions: string[] = sessionData.permissions ?? [];
        if (orgName && isFineGrainedPermissionsEnabled) {
            try {
                const orgId = await getOrgIdFromName(orgName);
                permissions = await getAllUserScopedPermissions({
                    sessionPermissions: sessionData.permissions ?? [],
                    userId: sessionData.user.sub,
                    orgId,
                    forceFineGrained: isFineGrainedPermissionsEnabled
                });
            } catch (error) {
                console.error("Failed to fetch fine-grained resource permissions", error);
            }
        }

        if (permissions.length === 0) {
            console.error("User does not have any permissions", {
                userId: sessionData.user.sub,
                orgName,
                permissions,
                isFineGrainedPermissionsEnabled,
                isEnforcePermissions
            });
        }
        return NextResponse.json({
            userId: sessionData.user.sub,
            orgName,
            permissions,
            isFineGrainedPermissionsEnabled,
            isEnforcePermissions
        });
    } catch (error) {
        console.error("Failed to parse permissions from access token", error);
        return NextResponse.json({ error: "Failed to parse permissions" }, { status: 500 });
    }
}
