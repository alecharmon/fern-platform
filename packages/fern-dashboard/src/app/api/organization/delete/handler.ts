import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

interface DeleteOrganizationRequestBody {
    organizationId: string;
}

export default async function deleteOrganization(accessToken: string, body: DeleteOrganizationRequestBody) {
    const venus = getVenusClient({ token: accessToken });
    const fdr = getOrpcFdrClient({ token: accessToken });

    // Delete all docs sites for this org before deleting the org itself
    try {
        const { deletedCount } = await fdr.dashboard.deleteAllDocsSitesForOrg({
            orgId: body.organizationId
        });

        console.log(`[DELETE_ORG_HANDLER] Deleted ${deletedCount} docs sites for org ${body.organizationId}`);
    } catch (error) {
        // Log but don't block org deletion if docs site deletion fails
        console.error("[DELETE_ORG_HANDLER] Error deleting docs sites:", error);
    }

    const result = await venus.organization.delete(body.organizationId);

    if (!result.ok) {
        console.error("[DELETE_ORG_HANDLER] Venus API error:", JSON.stringify(result.error, null, 2));
        throw new Error(JSON.stringify(result.error) || "Failed to delete organization");
    }

    return {
        organizationId: body.organizationId,
        success: true
    };
}
