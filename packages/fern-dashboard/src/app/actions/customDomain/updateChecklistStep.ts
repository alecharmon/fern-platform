"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { CustomDomainInfo } from "@/app/services/domain";
import {
    type ChecklistStepUpdates,
    formatVerificationInfo,
    getVerificationByDocsUrl,
    getVerificationByDomain,
    updateChecklistStep
} from "@/app/services/domain";

export interface UpdateChecklistStepRequest {
    docsUrl: string;
    orgName: Auth0OrgName;
    updates: ChecklistStepUpdates;
    domain?: string;
}

export interface UpdateChecklistStepResponse {
    success: boolean;
    domainInfo?: CustomDomainInfo;
    error?: string;
}

export async function updateDomainChecklistStep({
    docsUrl,
    orgName,
    updates,
    domain
}: UpdateChecklistStepRequest): Promise<UpdateChecklistStepResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    let verification = await getVerificationByDocsUrl(docsUrl);

    if (!verification && domain) {
        verification = await getVerificationByDomain(domain);
    }

    if (!verification) {
        return {
            success: false,
            error: "No custom domain verification found"
        };
    }

    const updated = await updateChecklistStep(verification.id, updates);

    return {
        success: true,
        domainInfo: formatVerificationInfo(updated)
    };
}
