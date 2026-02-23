import type { FdrAPI } from "@fern-api/fdr-sdk";
import { ApiDefinitionV1ToLatest, prune } from "@fern-api/fdr-sdk/api-definition";
import { transformEndpoint } from "@fern-api/fdr-sdk/converters";
import type { Pool } from "pg";
import { readBufferAsync } from "../utils/serde";

/**
 * Endpoint with its full context (types, auth schemes, global headers) in the latest API format.
 * This mirrors the v1 EndpointWithContext structure but uses the latest API definition types.
 */
export interface EndpointWithLatestContext {
    endpoint: FdrAPI.api.latest.EndpointDefinition;
    types: Record<FdrAPI.TypeId, FdrAPI.api.latest.TypeDefinition>;
    authSchemes: Record<FdrAPI.AuthSchemeId, FdrAPI.api.latest.AuthScheme> | undefined;
    globalHeaders: FdrAPI.api.latest.ObjectProperty[];
}

export async function getEndpointById(
    apiDefinitionId: string,
    endpointId: string,
    pool: Pool
): Promise<EndpointWithLatestContext | null> {
    // The endpointId might be in latest format (e.g., "endpoint_plant.updatePlant")
    // but the database stores v1 IDs (e.g., "updatePlant").
    // Extract the v1 ID (part after the last dot if present, otherwise use as-is).
    const v1EndpointId = endpointId.includes(".") ? endpointId.split(".").pop()! : endpointId;

    // Fetch endpoint and types in parallel
    const [endpointResult, typesResult] = await Promise.all([
        pool.query(`SELECT endpoint FROM "ApiEndpoint" WHERE "apiDefinitionId" = $1 AND "endpointId" = $2 LIMIT 1`, [
            apiDefinitionId,
            v1EndpointId
        ]),
        pool.query(`SELECT types FROM "ApiDefinitionTypes" WHERE "apiDefinitionId" = $1 LIMIT 1`, [apiDefinitionId])
    ]);

    if (endpointResult.rows.length === 0) {
        return null;
    }

    if (typesResult.rows.length === 0) {
        return null;
    }

    // Read the DbEndpointWithContext that was stored in the database
    const dbEndpointWithContext = (await readBufferAsync(
        endpointResult.rows[0].endpoint
    )) as FdrAPI.api.v1.db.DbEndpointWithContext;

    // Read the types that were stored separately
    const types = (await readBufferAsync(typesResult.rows[0].types)) as Record<
        FdrAPI.TypeId,
        FdrAPI.api.v1.read.TypeDefinition
    >;

    // Convert DB endpoint to read format
    const v1Endpoint = transformEndpoint({ dbShape: dbEndpointWithContext.endpoint });

    // Determine the migrated endpoint ID using the same logic as the migration
    const migratedEndpointId = ApiDefinitionV1ToLatest.createEndpointId(v1Endpoint);

    // Construct a minimal v1 API definition for migration
    const v1ApiDefinition: FdrAPI.api.v1.read.ApiDefinition = {
        id: apiDefinitionId as FdrAPI.ApiDefinitionId,
        rootPackage: {
            endpoints: [v1Endpoint],
            websockets: [],
            webhooks: [],
            types: Object.keys(types) as FdrAPI.TypeId[],
            subpackages: [],
            pointsTo: undefined
        },
        types: types,
        subpackages: {},
        auth: undefined,
        authSchemes: dbEndpointWithContext.authSchemes,
        hasMultipleBaseUrls: undefined,
        navigation: undefined,
        globalHeaders: dbEndpointWithContext.globalHeaders,
        snippetsConfiguration: undefined
    };

    // Migrate v1 to latest
    const migratedApiDefinition = ApiDefinitionV1ToLatest.from(v1ApiDefinition).migrate();

    // Look up the migrated endpoint using the ID we calculated
    const migratedEndpoint = migratedApiDefinition.endpoints[migratedEndpointId as FdrAPI.EndpointId];

    if (!migratedEndpoint) {
        return null;
    }

    // Prune the API definition to only include types referenced by this endpoint
    const prunedApiDefinition = prune(migratedApiDefinition, {
        type: "endpoint",
        endpointId: migratedEndpointId as FdrAPI.EndpointId
    });

    // Return the migrated endpoint with context in latest format
    // Only types that are referenced by the endpoint are included
    return {
        endpoint: migratedEndpoint,
        types: prunedApiDefinition.types,
        authSchemes: prunedApiDefinition.auths,
        globalHeaders: prunedApiDefinition.globalHeaders ?? []
    };
}
