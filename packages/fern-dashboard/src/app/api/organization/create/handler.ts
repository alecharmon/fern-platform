import { addRoles } from "@fern-api/user-permissions";
import { getOrganization, invalidateCachesAfterCreatingOrg } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

interface CreateOrganizationRequestBody {
    organizationId: string;
    displayName?: string;
    postmanTeamId?: string;
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

export default async function createOrganization(
    accessToken: string,
    userId: string,
    body: CreateOrganizationRequestBody
) {
    const venusClient = getVenusClient({ token: accessToken });

    const result = await venusClient.organization.create({
        // This is really the org name in Auth0 terms
        organizationId: body.organizationId,
        displayName: body.displayName,
        enableGithubConnection: true,
        artifactReadRequiresToken: false,
        postmanTeamId: body.postmanTeamId
    });

    if (!result.ok) {
        throw new Error(getErrorMessage(result.error, body.organizationId));
    }

    // Kind of tricky: we need to assign the user as an admin of the organization
    // after creating it. If we fail to assign the role, we should delete the
    // organization to avoid having an org without any admins.
    // The user can always try again to create the org.
    try {
        // Venus does not return the org ID, so we need to fetch it
        const org = await getOrganization(Auth0OrgName(body.organizationId));

        // Assign the creator as an admin of the organization
        const addRoleResult = await addRoles({
            userId: userId,
            orgId: org.id,
            roleNames: ["admin"]
        });

        if (addRoleResult.ok === false) {
            // Attempt to clean up by deleting the organization if role assignment fails
            await venusClient.organization.delete(body.organizationId);
            throw new Error(`Failed to assign admin role to user: ${addRoleResult.statusText}`);
        }
        await invalidateCachesAfterCreatingOrg(Auth0OrgName(body.organizationId));

        return {
            organizationId: body.organizationId,
            orgId: org.id,
            success: true
        };
    } catch (error) {
        // Attempt to clean up by deleting the organization if any error occurs
        await venusClient.organization.delete(body.organizationId);
        throw error;
    }
}
