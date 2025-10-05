import type { OrgEdgeFlags } from "@fern-api/docs-utils";
import { getEdgeFlagsForOrg } from "@fern-docs/edge-config";

export async function checkOrgHasFlag(orgName: string, flagKey: keyof OrgEdgeFlags): Promise<boolean> {
    try {
        const flagConfig = await getEdgeFlagsForOrg(orgName);
        if (!flagConfig) {
            return false;
        }
        return flagConfig[flagKey] ?? false;
    } catch (error) {
        console.error(`Failed to check org flag for ${orgName}:${flagKey}`, error);
        return false;
    }
}
