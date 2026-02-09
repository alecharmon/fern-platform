import type {
    EndpointDefinition,
    Environment,
    EnvironmentId,
    WebSocketChannel
} from "@fern-api/fdr-sdk/api-definition";
import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { sanitizeUrl } from "@fern-api/ui-core-utils";
import { useFernUser } from "@fern-docs/components/state/fern-user";

import { useApiDefinitionIdFromContext } from "@/contexts/ApiDefinitionIdContext";
import { useSelectedEnvironmentId, useSelectedEnvironmentUrl } from "@/state/environment";

/**
 * Filters environments based on audience matching.
 *
 * An environment is visible if:
 * - It has no audiences defined (accessible to everyone), OR
 * - At least one of its audiences matches a user role
 *
 * @param environments - The list of environments to filter
 * @param userRoles - The user's roles/audiences (empty array if not logged in)
 * @returns Filtered list of environments the user can access
 */
export function filterEnvironmentsByAudience(
    environments: Environment[] | undefined,
    userRoles: string[]
): Environment[] | undefined {
    if (environments == null) {
        return undefined;
    }

    return environments.filter((env) => {
        // If environment has no audiences, it's accessible to everyone
        if (env.audiences == null || env.audiences.length === 0) {
            return true;
        }

        // If user has no roles, they can only see environments with no audiences
        if (userRoles.length === 0) {
            return false;
        }

        // Check if user has at least one matching audience
        return env.audiences.some((audience) => userRoles.includes(audience));
    });
}

/**
 * Hook to get environments filtered by the current user's audiences.
 *
 * Combines PlaygroundSettings.environments filtering (explicit environment ID list)
 * with audience-based filtering (environment.audiences vs user.roles).
 *
 * @param environments - The list of environments from the endpoint/channel
 * @param settingsEnvironments - Optional list of allowed environment IDs from PlaygroundSettings
 * @returns Filtered list of environments the user can access
 */
export function useFilteredEnvironments(
    environments: Environment[] | undefined,
    settingsEnvironments: EnvironmentId[] | undefined
): Environment[] | undefined {
    const user = useFernUser();
    const userRoles = user?.roles ?? [];

    // First, filter by PlaygroundSettings.environments (explicit allow list)
    const settingsFiltered = settingsEnvironments
        ? environments?.filter((env) => settingsEnvironments.includes(env.id))
        : environments;

    // Then, filter by audience matching
    return filterEnvironmentsByAudience(settingsFiltered, userRoles);
}

function selectEnvironment(
    endpoint: WebSocketChannel | EndpointDefinition,
    selectedEnvironmentId?: string
): Environment | undefined {
    return (
        endpoint.environments?.find((environment) => environment.id === selectedEnvironmentId) ??
        endpoint.environments?.find((environment) => environment.id === endpoint.defaultEnvironment) ??
        endpoint.environments?.[0]
    );
}

export function useSelectedEnvironment(endpoint: WebSocketChannel | EndpointDefinition): Environment | undefined {
    const selectedEnvironmentId = useSelectedEnvironmentId();
    return selectEnvironment(endpoint, selectedEnvironmentId);
}

export function usePlaygroundBaseUrl(
    endpoint: WebSocketChannel | EndpointDefinition,
    apiDefinitionId?: FdrAPI.ApiDefinitionId
): [baseUrl: string | undefined, environmentId: EnvironmentId | undefined] {
    const idFromContext = useApiDefinitionIdFromContext();
    const id = apiDefinitionId ?? idFromContext;
    const environment = useSelectedEnvironment(endpoint);
    const sanitizedBaseUrl = sanitizeUrl(environment?.baseUrl);
    const sanitizedPlaygroundUrl = useSelectedEnvironmentUrl(id);

    // if there is a protocol mismatch, force an update to the base url
    if (sanitizedPlaygroundUrl?.substring(0, 5) !== sanitizedBaseUrl?.substring(0, 5)) {
        return [sanitizedBaseUrl, environment?.id];
    }

    // prefer the user-set playground URL, if available
    return [sanitizedPlaygroundUrl ?? sanitizedBaseUrl, environment?.id];
}
