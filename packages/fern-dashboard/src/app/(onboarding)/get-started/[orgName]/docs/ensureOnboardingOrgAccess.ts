import "server-only";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { addUserToOrgById } from "@/app/services/auth0/management";
import { type Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess, getOrganizationForPostmanTeam } from "@/app/services/dal/organization";
import { isUserInTeam } from "@/app/services/postman/openapi-repository";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
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
        return session;
    } catch (error) {
        console.warn(`[Onboarding] User doesn't have access to org ${orgName}`, error);

        if (postmanTeamId && typeof postmanTeamId === "string") {
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

                console.warn(
                    `[Onboarding] User ${session.user.sub} is not in Postman team ${postmanTeamId}, redirecting to create-org`
                );
            }

            redirect(createOrgRedirect(postmanTeamId, requestedPath, searchParams));
        }

        redirect(createOrgRedirect(orgName, requestedPath, searchParams));
    }
}
