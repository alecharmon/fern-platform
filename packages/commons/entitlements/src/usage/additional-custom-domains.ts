/**
 * TODO: Implement when entitlements is used outside fern-platform (e.g. call FDR API).
 * Within fern-platform, callers override this via createUsageProvider({ additional_custom_domains: ... }).
 */
export async function getAdditionalCustomDomainsUsage(_orgId: string): Promise<number> {
    throw new Error(
        "getAdditionalCustomDomainsUsage is not implemented. Provide an additional_custom_domains override via createUsageProvider()."
    );
}
