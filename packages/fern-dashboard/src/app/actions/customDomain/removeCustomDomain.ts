"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import {
    deleteVerification,
    getVerificationByDocsUrl,
    getVerificationByDomain,
    removeDomainFromVercelProject
} from "@/app/services/domain";

export interface RemoveCustomDomainRequest {
    docsUrl: string;
    orgName: Auth0OrgName;
    domain?: string;
}

export interface RemoveCustomDomainResponse {
    success: boolean;
    error?: string;
}

export async function removeCustomDomain({
    docsUrl,
    orgName,
    domain
}: RemoveCustomDomainRequest): Promise<RemoveCustomDomainResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Get existing verification record by docsUrl first
    let verification = await getVerificationByDocsUrl(docsUrl);

    // If not found by docsUrl, try to find by domain name
    // This handles the case where the docsUrl changed after publishing
    if (!verification && domain) {
        verification = await getVerificationByDomain(domain);
    }

    if (!verification) {
        // No custom domain configured, nothing to remove
        return { success: false, error: "No custom domain verification record found." };
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
