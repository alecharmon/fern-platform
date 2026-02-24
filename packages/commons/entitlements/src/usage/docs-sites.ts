/**
 * TODO: Implement when entitlements is used outside fern-platform (e.g. call FDR API).
 * Within fern-platform, callers override this via createUsageProvider({ docs_sites: ... }).
 */
export async function getDocsSitesUsage(_orgId: string): Promise<number> {
    throw new Error("getDocsSitesUsage is not implemented. Provide a docs_sites override via createUsageProvider().");
}
