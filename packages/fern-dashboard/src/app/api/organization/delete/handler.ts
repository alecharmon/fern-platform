import type { DashboardDocsSite } from "@fern-api/fdr-sdk/orpc-client";

import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

interface DeleteOrganizationRequestBody {
    organizationId: string;
}

export default async function deleteOrganization(accessToken: string, body: DeleteOrganizationRequestBody) {
    const venus = getVenusClient({ token: accessToken });
    const fdr = getOrpcFdrClient({ token: accessToken });

    // Unpublish all docs sites for this org before deleting it
    try {
        const response = await fdr.dashboard.getDocsSitesForOrg({
            orgId: body.organizationId
        });

        console.log(
            `[DELETE_ORG_HANDLER] Found ${response.docsSites.length} docs sites for org ${body.organizationId}`
        );

        const unpublishResults = await Promise.allSettled(
            response.docsSites.map(async (site: DashboardDocsSite) => {
                const domain = site.mainUrl.domain;
                const basepath = site.mainUrl.path ?? undefined;
                console.log(`[DELETE_ORG_HANDLER] Unpublishing docs site: ${domain}${basepath ?? ""}`);
                return fdr.docsDeployment.setDocsStatus({
                    domain,
                    orgId: body.organizationId,
                    basepath,
                    status: "UNPUBLISHED"
                });
            })
        );

        for (const result of unpublishResults) {
            if (result.status === "rejected") {
                console.error("[DELETE_ORG_HANDLER] Failed to unpublish a docs site:", result.reason);
            }
        }
    } catch (error) {
        // Log but don't block org deletion if unpublishing fails
        console.error("[DELETE_ORG_HANDLER] Error unpublishing docs sites:", error);
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
