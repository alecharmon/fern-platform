import "server-only";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess, getOrganizationForPostmanTeam } from "@/app/services/dal/organization";
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

    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName as Auth0OrgName);
        return session;
    } catch (error) {
        console.warn(`[Onboarding] User doesn't have access to org ${orgName}`, error);

        // If postman-team-id is present, check if an org already exists for this team
        const postmanTeamId = searchParams?.["postman-team-id"];
        if (postmanTeamId && typeof postmanTeamId === "string") {
            const result = await getOrganizationForPostmanTeam(session.accessToken, postmanTeamId);

            if (result.success) {
                // Organization exists for this Postman team, redirect to the proper org path
                let targetPath = requestedPath.replace(`/get-started/${orgName}`, `/get-started/${result.orgId}`);

                // Preserve search params in the redirect
                const queryString = serializeSearchParams(searchParams);
                if (queryString.toString()) {
                    targetPath = `${targetPath}?${queryString.toString()}`;
                }

                console.log(
                    `[Onboarding] Found existing org ${result.orgId} for Postman team ${postmanTeamId}, redirecting to ${targetPath}`
                );
                redirect(targetPath);
            }

            // No existing org found, redirect to create-org with postman-team-id as prefill
            redirect(createOrgRedirect(postmanTeamId, requestedPath, searchParams));
        }

        // No postman-team-id, use orgName from URL
        redirect(createOrgRedirect(orgName, requestedPath, searchParams));
    }
}
