import { getVenusClient } from "@/app/services/venus/getVenusClient";

interface DeleteOrganizationRequestBody {
    organizationId: string;
}

export default async function deleteOrganization(accessToken: string, body: DeleteOrganizationRequestBody) {
    const venus = getVenusClient({ token: accessToken });

    console.log("[DELETE_ORG_HANDLER] Deleting organization:", body.organizationId);
    const result = await venus.organization.delete(body.organizationId);

    console.log("[DELETE_ORG_HANDLER] Venus API result:", { ok: result.ok, error: result.error });

    if (!result.ok) {
        console.error("[DELETE_ORG_HANDLER] Venus API error:", JSON.stringify(result.error, null, 2));
        throw new Error(JSON.stringify(result.error) || "Failed to delete organization");
    }

    return {
        organizationId: body.organizationId,
        success: true
    };
}
