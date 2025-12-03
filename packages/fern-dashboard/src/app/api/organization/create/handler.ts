import { invalidateCachesAfterCreatingOrg } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

interface CreateOrganizationRequestBody {
    organizationId: string;
    displayName?: string;
}

function getErrorMessage(error: unknown, organizationId: string): string {
    if (error != null && typeof error === "object" && "error" in error) {
        const errorType = (error as { error: string }).error;
        if (errorType === "OrganizationAlreadyExistsError") {
            return `The "${organizationId}" organization already exists. If you are a member of this organization, please contact an admin to be added.`;
        }
        if (errorType === "UnauthorizedError") {
            return "You are not authorized to create an organization.";
        }
    }
    return "Failed to create organization";
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
        throw new Error(getErrorMessage(result.error, body.organizationId));
    }

    await invalidateCachesAfterCreatingOrg(Auth0OrgName(body.organizationId));

    return {
        organizationId: body.organizationId,
        success: true
    };
}
