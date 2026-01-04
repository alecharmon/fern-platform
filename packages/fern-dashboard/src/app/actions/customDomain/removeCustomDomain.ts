"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { deleteVerification, getVerificationByDocsUrl, removeDomainFromVercelProject } from "@/app/services/domain";

export interface RemoveCustomDomainRequest {
    docsUrl: string;
    orgName: Auth0OrgName;
}

export interface RemoveCustomDomainResponse {
    success: boolean;
    error?: string;
}

export async function removeCustomDomain({
    docsUrl,
    orgName
}: RemoveCustomDomainRequest): Promise<RemoveCustomDomainResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Get existing verification record
    const verification = await getVerificationByDocsUrl(docsUrl);

    if (!verification) {
        // No custom domain configured, nothing to remove
        return { success: true };
    }

    // Check org ownership
    if (verification.orgId !== orgName) {
        return {
            success: false,
            error: "Unauthorized: organization mismatch."
        };
    }

    try {
        // If domain was added to Vercel, remove it
        if (verification.status === "VERIFIED" && verification.domain) {
            const vercelResult = await removeDomainFromVercelProject(verification.domain);
            if (!vercelResult.success) {
                console.error("Failed to remove domain from Vercel:", vercelResult.error);
                // Continue anyway - we still want to remove from our DB
            }
        }

        // Delete the verification record
        await deleteVerification(verification.id);

        return { success: true };
    } catch (error) {
        console.error("Failed to remove custom domain:", error);
        return {
            success: false,
            error: "Failed to remove custom domain. Please try again."
        };
    }
}
