import { type APIV1Db, type APIV1Read, convertDbAPIDefinitionToRead, type FdrAPI } from "@fern-api/fdr-sdk";
import { ApiDefinitionV1ToLatest } from "@fern-api/fdr-sdk/api-definition";
import type { Pool } from "pg";
import { ApiDoesNotExistError } from "../errors";
import { readBufferAsync } from "../utils/serde";

/**
 * Loads the full API definition for a given API definition ID.
 * Uses ApiDefinitionsV2 (v1 format) and migrates it.
 */
export async function getApiDefinition(apiDefinitionId: string, pool: Pool): Promise<FdrAPI.api.latest.ApiDefinition> {
    const v1Result = await pool.query(
        `SELECT "definition"
         FROM "ApiDefinitionsV2"
         WHERE "apiDefinitionId" = $1
         LIMIT 1`,
        [apiDefinitionId]
    );

    if (v1Result.rows.length === 0) {
        throw new ApiDoesNotExistError();
    }

    const apiDefinitionJson = (await readBufferAsync(v1Result.rows[0].definition)) as APIV1Db.DbApiDefinition;
    const v1ApiDefinition: APIV1Read.ApiDefinition = convertDbAPIDefinitionToRead(apiDefinitionJson);

    // Migrate v1 to latest format
    return ApiDefinitionV1ToLatest.from(v1ApiDefinition).migrate();
}
