"use server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { VercelDnsRecord } from "@/app/services/domain";
import { getDomainConfigFromVercel, normalizeDomain, validateDomainFormat } from "@/app/services/domain";

export interface GetDnsRecordsRequest {
    domain: string;
    orgName: Auth0OrgName;
}

export interface GetDnsRecordsResponse {
    success: boolean;
    dnsRecords: VercelDnsRecord[];
    misconfigured: boolean;
    error?: string;
}

export async function getDnsRecords({ domain, orgName }: GetDnsRecordsRequest): Promise<GetDnsRecordsResponse> {
    const session = await getCurrentSessionOrThrow();
    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    // Validate domain format before making external API calls
    const validationResult = validateDomainFormat(domain);
    if (!validationResult.valid) {
        return {
            success: false,
            dnsRecords: [],
            misconfigured: true,
            error: validationResult.error
        };
    }

    const normalizedDomain = normalizeDomain(domain);

    try {
        const config = await getDomainConfigFromVercel(normalizedDomain);

        return {
            success: true,
            dnsRecords: config.dnsRecords,
            misconfigured: config.misconfigured,
            error: config.error
        };
    } catch (error) {
        return {
            success: false,
            dnsRecords: [],
            misconfigured: true,
            error: error instanceof Error ? error.message : "Failed to get DNS records"
        };
    }
}
