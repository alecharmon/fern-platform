"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { CustomDomainInfo } from "@/app/services/domain";
import {
    addDomainToVercelProject,
    createVerification,
    formatVerificationInfo,
    getVerificationByDocsUrl,
    getVerificationByDomain,
    getVerificationHost,
    hasSubpath,
    updateVerificationStatus,
    verifyTxtRecord
} from "@/app/services/domain";
import { assertRateLimit, DNS_VERIFICATION_RATE_LIMIT, RateLimitError } from "@/app/services/rateLimit";

export interface VerifyCustomDomainRequest {
    docsUrl: string;
    orgName: Auth0OrgName;
    domain?: string; // Optional domain for fallback lookup when docsUrl changes after publishing
}

export interface VerifyCustomDomainResponse {
    success: boolean;
    verified: boolean;
    domainInfo?: CustomDomainInfo;
    error?: string;
    requiresCheckout?: boolean;
}

export async function verifyCustomDomain({
    docsUrl,
    orgName,
    domain
}: VerifyCustomDomainRequest): Promise<VerifyCustomDomainResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Rate limit DNS verification attempts
    try {
        await assertRateLimit(orgName, "verify-domain", DNS_VERIFICATION_RATE_LIMIT);
    } catch (error) {
        if (error instanceof RateLimitError) {
            return { success: false, verified: false, error: error.message };
        }
        throw error;
    }

    // Get existing verification record
    // First try by docsUrl, then fallback to domain if provided
    // This handles the case where docsUrl changes after publishing the custom domain
    let verification = await getVerificationByDocsUrl(docsUrl);

    if (!verification && domain) {
        verification = await getVerificationByDomain(domain);
    }

    if (!verification) {
        return {
            success: false,
            verified: false,
            error: "No pending domain verification found. Please start the verification process again."
        };
    }

    // Check org ownership
    if (verification.orgId !== orgName) {
        return {
            success: false,
            verified: false,
            error: "Unauthorized: organization mismatch."
        };
    }

    // Check if ownership was already verified (TXT check passed previously)
    if (verification.ownershipVerified) {
        return {
            success: true,
            verified: true,
            domainInfo: formatVerificationInfo(verification)
        };
    }

    // If the TXT token has expired, re-issue a new verification with a fresh token
    if (new Date(verification.expiresAt) < new Date()) {
        const reissued = await createVerification({
            domain: verification.domain,
            docsUrl,
            orgId: orgName
        });
        return {
            success: true,
            verified: false,
            domainInfo: formatVerificationInfo(reissued),
            error: "Your verification token expired. A new one has been issued — please update your TXT record."
        };
    }

    // Verify DNS TXT record
    const verificationHost = getVerificationHost(verification.domain);
    const dnsResult = await verifyTxtRecord(verificationHost, verification.verificationValue);

    if (!dnsResult.verified) {
        return {
            success: true,
            verified: false,
            error: dnsResult.error || "DNS verification record not found.",
            domainInfo: formatVerificationInfo(verification)
        };
    }

    // STUB: Check if checkout is required (for future Stripe integration)
    const requiresCheckout = false; // TODO: await checkIfCheckoutRequired(orgName);
    if (requiresCheckout) {
        return {
            success: true,
            verified: true,
            requiresCheckout: true,
            error: "Custom domains require a paid plan. Please upgrade to continue.",
            domainInfo: formatVerificationInfo(verification)
        };
    }

    // Check if this is a subpath domain (e.g., example.com/docs)
    const isSubpathDomain = hasSubpath(verification.domain);

    if (isSubpathDomain) {
        // For subpath domains, we skip Vercel — user will configure their own proxy
        return {
            success: true,
            verified: true,
            domainInfo: formatVerificationInfo(verification)
        };
    }

    // DNS verified! Now add domain to Vercel (only for non-subpath domains)
    const vercelResult = await addDomainToVercelProject(verification.domain);

    if (!vercelResult.success) {
        return {
            success: false,
            verified: true,
            error: vercelResult.error || "Failed to add domain to Vercel.",
            domainInfo: formatVerificationInfo(verification)
        };
    }

    // Store the Vercel domain ID — status stays PENDING until all checklist steps complete
    const updatedVerification = await updateVerificationStatus(
        verification.id,
        verification.status,
        vercelResult.domainId
    );

    return {
        success: true,
        verified: true,
        domainInfo: formatVerificationInfo(updatedVerification)
    };
}
