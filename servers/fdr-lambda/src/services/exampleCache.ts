import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { EnhanceExampleRequest, EnhanceExampleResponse } from "./enhanceExample";

/**
 * Cache version - increment this to invalidate all cached examples.
 * Useful when changing the enhancement logic or prompt in ways that
 * should regenerate all examples.
 */
const CACHE_VERSION = 1;

export function computeRequestHash(request: EnhanceExampleRequest): string {
    const hashInput = {
        version: CACHE_VERSION,
        method: request.method,
        endpointPath: request.endpointPath,
        organizationId: request.organizationId,
        operationSummary: request.operationSummary,
        operationDescription: request.operationDescription,
        originalRequestExample: request.originalRequestExample,
        originalResponseExample: request.originalResponseExample,
        pathParameters: request.pathParameters,
        queryParameters: request.queryParameters,
        headers: request.headers,
        openApiSpec: request.openApiSpec,
        exampleStyleInstructions: request.exampleStyleInstructions
    };

    const hashString = JSON.stringify(hashInput, Object.keys(hashInput).sort());
    return createHash("sha256").update(hashString).digest("hex");
}

const MAX_STYLE_INSTRUCTIONS_LENGTH = 500;

/**
 * Normalize the request by truncating fields that have length limits.
 * This should be called early in the request handling to ensure consistent
 * hashing and prompt generation.
 */
export function normalizeRequest(request: EnhanceExampleRequest): EnhanceExampleRequest {
    if (request.exampleStyleInstructions && request.exampleStyleInstructions.length > MAX_STYLE_INSTRUCTIONS_LENGTH) {
        return {
            ...request,
            exampleStyleInstructions: request.exampleStyleInstructions.slice(0, MAX_STYLE_INSTRUCTIONS_LENGTH)
        };
    }
    return request;
}

export async function getCachedExample(
    request: EnhanceExampleRequest,
    pool: Pool
): Promise<EnhanceExampleResponse | null> {
    try {
        const hash = computeRequestHash(request);

        const result = await pool.query(
            'SELECT "enhancedRequestExample", "enhancedResponseExample", "modelUsed" FROM "CachedEnhancedExample" WHERE "requestHash" = $1',
            [hash]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            enhancedRequestExample: row.enhancedRequestExample
                ? JSON.parse(row.enhancedRequestExample.toString("utf-8"))
                : undefined,
            enhancedResponseExample: row.enhancedResponseExample
                ? JSON.parse(row.enhancedResponseExample.toString("utf-8"))
                : undefined,
            modelUsed: row.modelUsed,
            requestId: "cached"
        };
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: intentional lambda logging
        console.error("[getCachedExample] Error retrieving from cache:", error);
        return null;
    }
}

export async function storeCachedExample(
    request: EnhanceExampleRequest,
    response: EnhanceExampleResponse,
    pool: Pool
): Promise<void> {
    try {
        const hash = computeRequestHash(request);

        const enhancedRequestBuffer = response.enhancedRequestExample
            ? Buffer.from(JSON.stringify(response.enhancedRequestExample), "utf-8")
            : null;
        const enhancedResponseBuffer = response.enhancedResponseExample
            ? Buffer.from(JSON.stringify(response.enhancedResponseExample), "utf-8")
            : null;

        // Upsert using INSERT ... ON CONFLICT
        await pool.query(
            `INSERT INTO "CachedEnhancedExample" ("requestHash", "organizationId", "domain", "basepath", "method", "endpointPath", "enhancedRequestExample", "enhancedResponseExample", "modelUsed", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT ("requestHash")
             DO UPDATE SET
                "enhancedRequestExample" = $7,
                "enhancedResponseExample" = $8,
                "modelUsed" = $9`,
            [
                hash,
                request.organizationId,
                request.domain ?? "",
                request.basepath ?? "",
                request.method,
                request.endpointPath,
                enhancedRequestBuffer,
                enhancedResponseBuffer,
                response.modelUsed
            ]
        );
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: intentional lambda logging
        console.error("[storeCachedExample] Error storing to cache:", error);
    }
}
