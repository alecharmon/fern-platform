import "server-only";

import { redirect } from "next/navigation";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";

const DEFAULT_NEXT_PATH = "/get-started/:orgId/docs";

function createOrgRedirect(orgName: string, requestedPath: string): string {
    const prefixedPath = `/get-started/${orgName}`;
    const nextPath = requestedPath.startsWith(prefixedPath)
        ? requestedPath.replace(prefixedPath, "/get-started/:orgId")
        : DEFAULT_NEXT_PATH;

    const params = new URLSearchParams({
        next: nextPath,
        prefillOrgName: orgName
    });

    return `/get-started/create-org?${params.toString()}`;
}

/**
 * Ensures the current user can access the onboarding flow for the provided org.
 * Redirects to the create-org step when the org is missing or inaccessible.
 */
export async function ensureOnboardingOrgAccess(orgName: string, requestedPath: string) {
    const session = await getCurrentSession();
    if (session == null) {
        redirect("/login");
    }

    try {
        await assertUserHasOrganizationAccess(session.accessToken, orgName as Auth0OrgName);
        return session;
    } catch (error) {
        console.warn(`[Onboarding] Redirecting to create-org for ${orgName}`, error);
        redirect(createOrgRedirect(orgName, requestedPath));
    }
}
