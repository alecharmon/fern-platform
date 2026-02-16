"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { CustomDomainInfo } from "@/app/services/domain";
import {
    createVerification,
    formatVerificationInfo,
    getVerificationByDocsUrl,
    isDomainAvailable,
    normalizeDomainWithSubpath,
    validateDomainFormat
} from "@/app/services/domain";
import { hasSubpath } from "@/app/services/domain/validation";
import { getEntitlementsChecker } from "@/app/services/entitlements/checker";
import { assertRateLimit, DOMAIN_RATE_LIMIT, RateLimitError } from "@/app/services/rateLimit";

export interface InitiateCustomDomainRequest {
    domain: string;
    docsUrl: string;
    orgName: Auth0OrgName;
}

export interface InitiateCustomDomainResponse {
    success: boolean;
    domainInfo?: CustomDomainInfo;
    error?: string;
    requiresUpgrade?: boolean;
}

export async function initiateCustomDomain({
    domain,
    docsUrl,
    orgName
}: InitiateCustomDomainRequest): Promise<InitiateCustomDomainResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Rate limit domain creation attempts
    try {
        await assertRateLimit(orgName, "initiate-domain", DOMAIN_RATE_LIMIT);
    } catch (error) {
        if (error instanceof RateLimitError) {
            return { success: false, error: error.message };
        }
        throw error;
    }

    // Validate domain format
    const validationResult = validateDomainFormat(domain);
    if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
    }

    const normalizedDomain = normalizeDomainWithSubpath(domain);

    // Check subpath entitlement (defense in depth)
    if (hasSubpath(normalizedDomain)) {
        const orgId = await getOrgIdFromName(orgName);
        const check = await getEntitlementsChecker().check(orgId, "custom_domain_subpath");
        if (!check.entitled) {
            return { success: false, error: "Custom subpath domains require a Pro plan.", requiresUpgrade: true };
        }
    }

    // Check if there's already a pending verification for this docsUrl with the same domain
    const existingVerification = await getVerificationByDocsUrl(docsUrl);
    if (existingVerification) {
        const isExpired = new Date(existingVerification.expiresAt) < new Date();
        const isSameDomain = existingVerification.domain === normalizedDomain;
        const isPending = existingVerification.status === "PENDING";

        // If same domain, not expired, and still pending, return the existing verification
        if (isSameDomain && !isExpired && isPending) {
            return {
                success: true,
                domainInfo: formatVerificationInfo(existingVerification)
            };
        }
    }

    // Check if domain is available
    const available = await isDomainAvailable(normalizedDomain, docsUrl);
    if (!available) {
        return {
            success: false,
            error: "This domain is already in use by another documentation site."
        };
    }

    try {
        // Create verification record
        const verification = await createVerification({
            domain: normalizedDomain,
            docsUrl,
            orgId: orgName
        });

        return {
            success: true,
            domainInfo: formatVerificationInfo(verification)
        };
    } catch (error) {
        console.error("Failed to initiate custom domain:", error);
        return {
            success: false,
            error: "Failed to initiate domain verification. Please try again."
        };
    }
}
