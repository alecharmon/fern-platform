import "server-only";

import { addRoles } from "@fern-api/user-permissions";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { addUserToOrgById, getOrgIdFromName } from "@/app/services/auth0/management";
import { type Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess, getOrganizationForPostmanTeam } from "@/app/services/dal/organization";
import { getEntitlementsChecker } from "@/app/services/entitlements/checker";
import { isUserInTeam } from "@/app/services/postman/openapi-repository";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";
import { serializeSearchParams } from "./serializeSearchParams";

const DEFAULT_NEXT_PATH = "/get-started/:orgId/docs";

function createOrgRedirect(
    orgName: string,
    requestedPath: string,
    searchParams?: Record<string, string | string[] | undefined>
): string {
    const prefixedPath = `/get-started/${orgName}`;
    const nextPath = requestedPath.startsWith(prefixedPath)
        ? requestedPath.replace(prefixedPath, "/get-started/:orgId")
        : DEFAULT_NEXT_PATH;

    const params = new URLSearchParams({
        next: nextPath,
        prefillOrgName: orgName
    });

    // Preserve searchParams in the create-org redirect
    const additionalParams = serializeSearchParams(searchParams);
    additionalParams.forEach((value, key) => {
        params.append(key, value);
    });

    return `/get-started/create-org?${params.toString()}`;
}

/**
 * Ensures the current user can access the onboarding flow for the provided org.
 * Redirects to the create-org step when the org is missing or inaccessible.
 */
export async function ensureOnboardingOrgAccess(
    orgName: string,
    requestedPath: string,
    searchParams?: Record<string, string | string[] | undefined>
) {
    const session = await getCurrentSession();
    if (session == null) {
        // Check for postman-team-id parameter
        const postmanTeamId = searchParams?.["postman-team-id"];
        if (postmanTeamId) {
            // Preserve all query parameters in the redirect
            const queryString = serializeSearchParams(searchParams);
            const redirectUrl = `${requestedPath}${queryString.toString() ? `?${queryString.toString()}` : ""}`;
            const postmanAuthUrl = `/auth/login?connection=postman&redirect_on_login=${encodeURIComponent(redirectUrl)}`;
            redirect(postmanAuthUrl);
        }

        redirect("/login");
    }

    const postmanTeamId = searchParams?.["postman-team-id"];

    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName as Auth0OrgName);
    } catch (error) {
        console.warn(`[Onboarding] User doesn't have access to org ${orgName}`, error);

        if (postmanTeamId && typeof postmanTeamId === "string" && !requestedPath.includes("create-org")) {
            const result = await getOrganizationForPostmanTeam(session.accessToken, postmanTeamId);

            if (result.success) {
                const userId = Auth0UserID(session.user.sub);
                let userInPostmanTeam = false;

                // We don't want to block the onboarding flow if we fail to check if the user is in the Postman team
                try {
                    userInPostmanTeam = await isUserInTeam(userId, postmanTeamId);
                } catch (error) {
                    console.error(
                        `[Onboarding] Failed to check if user ${userId} is in Postman team ${postmanTeamId}`,
                        error
                    );
                    userInPostmanTeam = false;
                }

                if (userInPostmanTeam) {
                    const venus = getVenusClient({ token: session.accessToken });
                    await venus.organization.addUser({ orgId: result.orgId, userId });
                    await addUserToOrgById(userId, result.auth0OrgId);

                    // Assign admin role to the user
                    try {
                        await addRoles({
                            userId,
                            orgId: result.auth0OrgId,
                            roleNames: ["admin"]
                        });
                        console.log(`[Onboarding] Assigned admin role to user ${userId} in org ${result.orgId}`);
                    } catch (error) {
                        console.error(
                            `[Onboarding] Failed to assign admin role to user ${userId} in org ${result.orgId}`,
                            error
                        );
                    }

                    console.log(
                        `[Onboarding] Auto-added user ${userId} to org ${result.orgId} for Postman team ${postmanTeamId}`
                    );

                    // Redirect to the correct org path so the page loads with proper access
                    let targetPath = requestedPath.replace(`/get-started/${orgName}`, `/get-started/${result.orgId}`);
                    const queryString = serializeSearchParams(searchParams);
                    if (queryString.toString()) {
                        targetPath = `${targetPath}?${queryString.toString()}`;
                    }
                    redirect(targetPath);
                }
            }

            console.warn(
                `[Onboarding] User ${session.user.sub} is not in Postman team ${postmanTeamId}, redirecting to create-org`
            );
            // Strip postman-team-id and collectionId from search params to prevent infinite loop and block non-authed users
            const clonedSearchParams = { ...searchParams };
            const { "postman-team-id": _pti, "collection-id": _ci, ...sanitizedSearchParams } = clonedSearchParams;

            redirect(createOrgRedirect(orgName, requestedPath, sanitizedSearchParams));
        }

        redirect(createOrgRedirect(orgName, requestedPath, searchParams));
    }

    // Check docs_sites entitlement (gated behind feature flag)
    const entitlementsEnabled = await isFeatureFlagEnabledForUser(
        PosthogFeatureFlag.ENABLE_ENTITLEMENTS,
        session.user.sub,
        orgName as Auth0OrgName
    );
    if (entitlementsEnabled) {
        try {
            const orgId = await getOrgIdFromName(orgName as Auth0OrgName);
            const checker = getEntitlementsChecker();
            const result = await checker.check(orgId, "docs_sites");
            if (!result.entitled) {
                redirect(`/${orgName}/billing?reason=docs_site_limit`);
            }
        } catch (err) {
            // Re-throw Next.js redirects
            if (typeof err === "object" && err !== null && "digest" in err) {
                throw err;
            }
            // If entitlement check fails, allow through rather than blocking
            console.warn(`[Onboarding] Failed to check docs_sites entitlement for ${orgName}`, err);
        }
    }

    return session;
}
