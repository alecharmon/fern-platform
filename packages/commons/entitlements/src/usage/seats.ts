/**
 * Get current seat usage for an org.
 * TODO: Wire up to actual org member count query.
 */
export async function getSeatsUsage(_orgId: string): Promise<number> {
    throw new Error("getSeatsUsage not implemented. Wire up to org member count.");
}
