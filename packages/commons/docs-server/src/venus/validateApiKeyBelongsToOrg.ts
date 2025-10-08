import { FernVenusApi } from "@fern-api/venus-api-sdk";

import { getVenusClient } from "./getVenusClient";

export interface ValidateApiKeyResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates that an API key (fern_xxx) belongs to a specific organization using Venus
 *
 * @param apiKey - The Fern API key (must start with "fern_")
 * @param orgId - The organization ID to check membership for
 * @returns Object indicating if validation succeeded and any error message
 */
export async function validateApiKeyBelongsToOrg(apiKey: string, orgId: string): Promise<ValidateApiKeyResult> {
    try {
        if (!apiKey.startsWith("fern_")) {
            return {
                valid: false,
                error: "Invalid API key format. Must start with 'fern_'"
            };
        }

        const venus = getVenusClient({ token: apiKey });
        const response = await venus.organization.isMember(FernVenusApi.OrganizationId(orgId));

        // response.ok === false means the API key is invalid or the request failed
        if (!response.ok) {
            console.error("Failed to validate API key with Venus:", response.error);
            return {
                valid: false,
                error: "Failed to validate API key with authentication service"
            };
        }

        // response.ok === true means the API key is valid
        // response.body === true means the user belongs to the org
        // response.body === false means the user does NOT belong to the org
        const belongsToOrg = response.body;
        if (!belongsToOrg) {
            return {
                valid: false,
                error: `API key does not belong to organization: ${orgId}`
            };
        }

        return { valid: true };
    } catch (error) {
        console.error("Error validating API key:", error);
        return {
            valid: false,
            error: error instanceof Error ? error.message : "Unknown error during validation"
        };
    }
}
