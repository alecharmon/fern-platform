import { FernVenusApi, FernVenusApiClient } from "@fern-api/venus-api-sdk";
import { UnauthorizedError, UnavailableError, UserNotInOrgError } from "../errors";

const BEARER_REGEX = /^bearer\s+/i;

export function getTokenFromAuthHeader(authHeader: string): string {
    return authHeader.replace(BEARER_REGEX, "");
}

function getVenusClient(token: string): FernVenusApiClient {
    const venusUrl = process.env.VENUS_URL;
    if (!venusUrl) {
        throw new Error("VENUS_URL environment variable is not set");
    }

    return new FernVenusApiClient({
        environment: venusUrl,
        token
    });
}

/**
 * Check if the user belongs to the specified organization.
 * Follows the same pattern as FDR's AuthService.
 *
 * First checks if user belongs to "fern" org (internal access).
 * If not, checks if user belongs to the specific org.
 *
 * @throws {UnauthorizedError} if no auth header provided
 * @throws {UnavailableError} if Venus API call fails
 * @throws {UserNotInOrgError} if user doesn't belong to org
 */
export async function checkUserBelongsToOrg({
    authHeader,
    orgId
}: {
    authHeader: string | undefined;
    orgId: string;
}): Promise<void> {
    if (authHeader == null) {
        throw new UnauthorizedError("Authorization header was not specified");
    }

    const token = getTokenFromAuthHeader(authHeader);
    const venus = getVenusClient(token);

    // First check if user belongs to "fern" org (internal access)
    try {
        const fernOrgResponse = await venus.organization.isMember(FernVenusApi.OrganizationId("fern"));
        if (fernOrgResponse.ok && fernOrgResponse.body) {
            return;
        }
    } catch (_error) {
        // Continue to check specific org
    }

    // Check if user belongs to the specific org
    const response = await venus.organization.isMember(FernVenusApi.OrganizationId(orgId));
    if (!response.ok) {
        throw new UnavailableError("Failed to resolve user's organizations");
    }

    const belongsToOrg = response.body;
    if (!belongsToOrg) {
        throw new UserNotInOrgError("User does not belong to organization");
    }
}
