/**
 * TODO: Implement when entitlements is used outside fern-platform (e.g. call FDR API).
 * Within fern-platform, callers override this via createUsageProvider({ number_of_custom_domains: ... }).
 */
export async function getCustomDomainsUsage(_orgId: string): Promise<number> {
    throw new Error(
        "getCustomDomainsUsage is not implemented. Provide a number_of_custom_domains override via createUsageProvider()."
    );
}
