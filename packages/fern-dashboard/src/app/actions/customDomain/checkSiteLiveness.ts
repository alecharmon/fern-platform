"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { CustomDomainInfo } from "@/app/services/domain";
import {
    formatVerificationInfo,
    getVerificationByDocsUrl,
    getVerificationByDomain,
    updateVerificationStatus
} from "@/app/services/domain";

export interface CheckSiteLivenessRequest {
    domain: string;
    docsUrl: string;
    orgName: Auth0OrgName;
}

export interface CheckSiteLivenessResponse {
    live: boolean;
    domainInfo?: CustomDomainInfo;
    error?: string;
}

export async function checkSiteLiveness({
    domain,
    docsUrl,
    orgName
}: CheckSiteLivenessRequest): Promise<CheckSiteLivenessResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Look up verification record
    let verification = await getVerificationByDocsUrl(docsUrl);
    if (!verification) {
        verification = await getVerificationByDomain(domain);
    }

    if (!verification) {
        return { live: false, error: "No verification record found." };
    }

    // Check if the site is actually reachable
    try {
        const response = await fetch(`https://${domain}`, {
            redirect: "follow",
            signal: AbortSignal.timeout(10_000)
        });

        if (response.ok) {
            // Site is live — mark as VERIFIED
            const updated = await updateVerificationStatus(verification.id, "VERIFIED");
            return { live: true, domainInfo: formatVerificationInfo(updated) };
        }

        return { live: false };
    } catch {
        // Network error, DNS not propagated yet, timeout, etc.
        return { live: false };
    }
}
