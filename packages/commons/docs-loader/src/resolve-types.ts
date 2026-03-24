import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import type { TypeId } from "@fern-api/fdr-sdk/navigation";

/**
 * Input data for resolving types from a docs definition response.
 */
export interface ResolveTypesInput {
    /** Mapping from user-facing API name to API definition ID (from DB column) */
    apiNameToId?: Record<string, string> | null;
}

/**
 * Callback to fetch a full API definition by its definition ID.
 */
export type GetApiById = (apiDefinitionId: string) => Promise<ApiDefinition.ApiDefinition>;

/**
 * Core type-resolution logic extracted from getTypes() for testability.
 *
 * Uses apiNameToId to map user-facing API names to definition IDs,
 * then fetches the full API definition via getApiById to collect types.
 *
 * When apiName is specified, only the matching API is fetched.
 * When apiName is not specified, all APIs in apiNameToId are fetched.
 */
export async function resolveTypes(
    input: ResolveTypesInput,
    apiName: string | undefined,
    getApiById: GetApiById
): Promise<Record<TypeId, TypeDefinition>> {
    const allTypes: Record<TypeId, TypeDefinition> = {};
    const { apiNameToId } = input;

    if (apiNameToId == null) {
        return allTypes;
    }

    if (apiName != null) {
        const apiDefinitionId = apiNameToId[apiName];
        if (apiDefinitionId != null) {
            const api = await getApiById(apiDefinitionId);
            if (api.types) {
                Object.assign(allTypes, api.types);
            }
        }
    } else {
        const fetchPromises = Object.entries(apiNameToId).map(async ([_, apiDefinitionId]) => {
            const api = await getApiById(apiDefinitionId);
            return api.types ?? {};
        });
        const results = await Promise.all(fetchPromises);
        for (const types of results) {
            Object.assign(allTypes, types);
        }
    }

    return allTypes;
}
