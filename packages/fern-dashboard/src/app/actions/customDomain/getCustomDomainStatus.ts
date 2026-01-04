"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { CustomDomainInfo } from "@/app/services/domain";
import { formatVerificationInfo, getVerificationByDocsUrl, updateVerificationStatus } from "@/app/services/domain";

export interface GetCustomDomainStatusRequest {
    docsUrl: string;
    orgName: Auth0OrgName;
}

export interface GetCustomDomainStatusResponse {
    success: boolean;
    hasCustomDomain: boolean;
    domainInfo?: CustomDomainInfo;
    error?: string;
}

export async function getCustomDomainStatus({
    docsUrl,
    orgName
}: GetCustomDomainStatusRequest): Promise<GetCustomDomainStatusResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const verification = await getVerificationByDocsUrl(docsUrl);

    if (!verification) {
        return {
            success: true,
            hasCustomDomain: false
        };
    }

    // Check if the verification has expired
    if (verification.status === "PENDING" && new Date(verification.expiresAt) < new Date()) {
        // Mark as expired
        await updateVerificationStatus(verification.id, "EXPIRED");
        return {
            success: true,
            hasCustomDomain: false
        };
    }

    // Don't show expired verifications
    if (verification.status === "EXPIRED") {
        return {
            success: true,
            hasCustomDomain: false
        };
    }

    return {
        success: true,
        hasCustomDomain: true,
        domainInfo: formatVerificationInfo(verification)
    };
}
