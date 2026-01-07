"use server";

import { postToSlack } from "@fern-api/docs-server/slack";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { CustomDomainInfo } from "@/app/services/domain";
import {
    addDomainToVercelProject,
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

    // Check if already verified
    if (verification.status === "VERIFIED") {
        return {
            success: true,
            verified: true,
            domainInfo: formatVerificationInfo(verification)
        };
    }

    // Check if expired
    if (new Date(verification.expiresAt) < new Date()) {
        await updateVerificationStatus(verification.id, "EXPIRED");
        return {
            success: false,
            verified: false,
            error: "Verification token has expired. Please start the verification process again."
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
        // For subpath domains, we skip Vercel and just mark as verified
        // User will configure their own proxy
        const updatedVerification = await updateVerificationStatus(verification.id, "VERIFIED");

        // Send Slack notification for subpath domain verification (proxy setup step)
        postToSlack(
            "#dashboard-custom-domain-notifs",
            `*[${orgName}]* Custom domain added (subpath/proxy): *${verification.domain}*\nUser: *<mailto:${session.user.email}|${session.user.email ?? "unknown"}>*`,
            "custom-domain"
        );

        return {
            success: true,
            verified: true,
            domainInfo: formatVerificationInfo(updatedVerification)
        };
    }

    // DNS verified! Now add domain to Vercel (only for non-subpath domains)
    const vercelResult = await addDomainToVercelProject(verification.domain);

    if (!vercelResult.success) {
        await updateVerificationStatus(verification.id, "FAILED");
        return {
            success: false,
            verified: true,
            error: vercelResult.error || "Failed to add domain to Vercel.",
            domainInfo: formatVerificationInfo(verification)
        };
    }

    // Update verification status to VERIFIED
    const updatedVerification = await updateVerificationStatus(verification.id, "VERIFIED", vercelResult.domainId);

    // Send Slack notification for subdomain verification (DNS records verified)
    postToSlack(
        "#dashboard-custom-domain-notifs",
        `*[${orgName}]* Custom domain added (subdomain): *${verification.domain}*\nUser: *<mailto:${session.user.email}|${session.user.email ?? "unknown"}>*`,
        "custom-domain"
    );

    return {
        success: true,
        verified: true,
        domainInfo: formatVerificationInfo(updatedVerification)
    };
}
