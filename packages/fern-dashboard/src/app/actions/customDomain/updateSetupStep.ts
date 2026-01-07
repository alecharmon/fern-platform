"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { CustomDomainInfo, DomainSetupStep } from "@/app/services/domain";
import { formatVerificationInfo, getVerificationByDocsUrl, updateSetupStep } from "@/app/services/domain";

export interface UpdateSetupStepRequest {
    docsUrl: string;
    orgName: Auth0OrgName;
    step: DomainSetupStep;
}

export interface UpdateSetupStepResponse {
    success: boolean;
    domainInfo?: CustomDomainInfo;
    error?: string;
}

export async function updateDomainSetupStep({
    docsUrl,
    orgName,
    step
}: UpdateSetupStepRequest): Promise<UpdateSetupStepResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    const verification = await getVerificationByDocsUrl(docsUrl);

    if (!verification) {
        return {
            success: false,
            error: "No custom domain verification found"
        };
    }

    const updated = await updateSetupStep(verification.id, step);

    return {
        success: true,
        domainInfo: formatVerificationInfo(updated)
    };
}
