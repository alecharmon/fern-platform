"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { CustomDomainInfo } from "@/app/services/domain";
import { formatVerificationInfo, getVerificationByDocsUrl, getVerificationByDomain } from "@/app/services/domain";
import { fernCliConfig } from "@/utils/fernCliConfig";

export interface GetCustomDomainStatusRequest {
    docsUrl: string;
    orgName: Auth0OrgName;
    detectedDomains?: string[];
}

export interface GetCustomDomainStatusResponse {
    success: boolean;
    hasCustomDomain: boolean;
    domainInfo?: CustomDomainInfo;
    error?: string;
}

export async function getCustomDomainStatus({
    docsUrl,
    orgName,
    detectedDomains = []
}: GetCustomDomainStatusRequest): Promise<GetCustomDomainStatusResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // First, try to find verification by docsUrl
    let verification = await getVerificationByDocsUrl(docsUrl);

    // If not found by docsUrl, try to find by detected custom domains
    // This handles the case where the user started verification but the docsUrl changed after publishing
    if (!verification && detectedDomains.length > 0) {
        for (const domain of detectedDomains) {
            // Skip Fern-managed domains
            if (domain.endsWith(`.${fernCliConfig.docsDomain}`)) {
                continue;
            }
            const domainVerification = await getVerificationByDomain(domain);
            if (domainVerification) {
                verification = domainVerification;
                break;
            }
        }
    }

    if (!verification) {
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
