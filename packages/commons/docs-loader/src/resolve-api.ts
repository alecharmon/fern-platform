import type { APIV1Read, ApiDefinition } from "@fern-api/fdr-sdk";
import { ApiDefinitionV1ToLatest } from "@fern-api/fdr-sdk/api-definition";
import { ApiDefinitionId } from "@fern-api/fdr-sdk/navigation";
import { logger } from "@fern-api/ui-core-utils/logger";

/**
 * Minimal interface for the registry service methods used during API resolution.
 */
export interface RegistryServiceApi {
    latest: {
        getApiLatest: (input: { apiDefinitionId: string }) => Promise<unknown>;
    };
    read: {
        getApi: (input: { apiDefinitionId: string }) => Promise<unknown>;
    };
}

/**
 * Resolves an API definition by ID using a cascading fallback strategy:
 *
 * 1. Return from `apisV2` (latest format) if present.
 * 2. Return from `apis` (v1 format), migrating to latest.
 * 3. Fetch from registry using the `/latest` endpoint.
 * 4. Fetch from registry using the v1 `/read` endpoint, migrating to latest.
 * 5. Throw if all sources fail.
 */
export async function resolveApiDefinition(
    id: string,
    apisV2: Record<string, unknown>,
    apisV1: Record<string, unknown>,
    registryApi: RegistryServiceApi,
    domainKey: string
): Promise<ApiDefinition.ApiDefinition> {
    // 1. Check apisV2 (latest format)
    const latest = apisV2[id];
    if (latest != null) {
        logger.debug(`[resolveApiDefinition] domain=${domainKey}, id=${id}, source=apisV2`);
        return latest as ApiDefinition.ApiDefinition;
    }

    // 2. Check apis (v1 format), migrate to latest
    const v1 = apisV1[id];
    if (v1 != null) {
        logger.debug(`[resolveApiDefinition] domain=${domainKey}, id=${id}, source=apisV1 (migrating to latest)`);
        return ApiDefinitionV1ToLatest.from(v1 as APIV1Read.ApiDefinition).migrate();
    }

    // 3. Try registry /latest endpoint (returns V2 format directly)
    try {
        logger.debug(`[resolveApiDefinition] domain=${domainKey}, id=${id}, source=registry/latest`);
        const latestApi = await registryApi.latest.getApiLatest({ apiDefinitionId: id });
        return latestApi as ApiDefinition.ApiDefinition;
    } catch {
        logger.debug(
            `[resolveApiDefinition] domain=${domainKey}, id=${id}, registry/latest failed, trying registry/read`
        );
    }

    // 4. Fall back to registry /read endpoint (v1 format) + migration
    try {
        const v1FromRegistry = await registryApi.read.getApi({ apiDefinitionId: id });
        return ApiDefinitionV1ToLatest.from(v1FromRegistry as APIV1Read.ApiDefinition).migrate();
    } catch (error) {
        throw new Error(`[resolveApiDefinition] Could not get API with ID ${ApiDefinitionId(id)}: ${String(error)}`);
    }
}
