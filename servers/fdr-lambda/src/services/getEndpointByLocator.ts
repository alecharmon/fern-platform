import type { FdrAPI } from "@fern-api/fdr-sdk";
import { ApiDefinitionV1ToLatest, prune } from "@fern-api/fdr-sdk/api-definition";
import { transformEndpoint } from "@fern-api/fdr-sdk/converters";
import type { Pool } from "pg";
import { readBufferAsync } from "../utils/serde";
import type { EndpointWithLatestContext } from "./getEndpointById";

export async function getEndpointByLocator(
    apiDefinitionId: string,
    method: string,
    path: string,
    pool: Pool
): Promise<EndpointWithLatestContext | null> {
    // Fetch endpoint and types in parallel
    const [endpointResult, typesResult] = await Promise.all([
        pool.query(
            `SELECT "endpointId", endpoint FROM "ApiEndpoint" WHERE "apiDefinitionId" = $1 AND "method" = $2 AND "path" = $3 LIMIT 1`,
            [apiDefinitionId, method, path]
        ),
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
    return {
        endpoint: migratedEndpoint,
        types: prunedApiDefinition.types,
        authSchemes: prunedApiDefinition.auths,
        globalHeaders: prunedApiDefinition.globalHeaders ?? []
    };
}
