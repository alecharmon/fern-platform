import { invalidateOrganizationNotFoundCache } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

interface CreateOrganizationRequestBody {
    organizationId: string;
    displayName?: string;
}

export default async function createOrganization(accessToken: string, body: CreateOrganizationRequestBody) {
    const venusClient = getVenusClient({ token: accessToken });

    const result = await venusClient.organization.create({
        organizationId: body.organizationId,
        displayName: body.displayName,
        enableGithubConnection: true,
        artifactReadRequiresToken: false
    });

    if (!result.ok) {
        throw new Error(result.error?.toString() || "Failed to create organization");
    }

    await invalidateOrganizationNotFoundCache(Auth0OrgName(body.organizationId));

    return {
        organizationId: body.organizationId,
        success: true
    };
}
