import { createHash } from "node:crypto";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Client } from "pg";
import type { EnhanceExampleRequest, EnhanceExampleResponse } from "./enhanceExample";

interface RDSSecret {
    username: string;
    password: string;
    engine?: string;
    host?: string;
    port?: number;
    dbname?: string;
}

interface DbConnectionDetails {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

let cachedConnectionDetails: DbConnectionDetails | null = null;

async function getConnectionDetails(): Promise<DbConnectionDetails | null> {
    if (cachedConnectionDetails) {
        return cachedConnectionDetails;
    }

    const secretId = process.env.DOCS_DB_SECRET_ID;
    if (!secretId) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.warn("[exampleCache] DOCS_DB_SECRET_ID not set, caching disabled");
        return null;
    }

    const client = new SecretsManagerClient({ region: "us-east-1" });

    try {
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secretId,
                VersionStage: "AWSCURRENT"
            })
        );

        if (!response.SecretString) {
            throw new Error("Secret value is empty");
        }

        const secret: RDSSecret = JSON.parse(response.SecretString);

        // Get connection details from secret or environment variables
        const host = secret.host || process.env.DB_HOST || "lambda-docs-db.cihbconq6tcp.us-east-1.rds.amazonaws.com";
        const port = secret.port || process.env.DB_PORT || "5432";
        const dbname = secret.dbname || process.env.DB_NAME || "lambdadocsdb";

        // Validate required fields
        if (!host || !dbname) {
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.warn("[exampleCache] Missing DB connection info, caching disabled");
            return null;
        }

        // Validate port
        const portNum = Number(port);
        if (Number.isNaN(portNum) || portNum <= 0 || portNum > 65535) {
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.error("[exampleCache] Invalid port number:", port);
            return null;
        }

        cachedConnectionDetails = {
            host,
            port: portNum,
            database: dbname,
            user: secret.username,
            password: secret.password
        };

        return cachedConnectionDetails;
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("[exampleCache] Failed to fetch database credentials:", error);
        return null;
    }
}

export function computeRequestHash(request: EnhanceExampleRequest): string {
    const hashInput = {
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
        openApiSpec: request.openApiSpec
    };

    const hashString = JSON.stringify(hashInput, Object.keys(hashInput).sort());
    return createHash("sha256").update(hashString).digest("hex");
}

export async function getCachedExample(request: EnhanceExampleRequest): Promise<EnhanceExampleResponse | null> {
    const connectionDetails = await getConnectionDetails();
    if (!connectionDetails) {
        return null;
    }

    const client = new Client({
        ...connectionDetails,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        const hash = computeRequestHash(request);

        const result = await client.query(
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
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("[getCachedExample] Error retrieving from cache:", error);
        return null;
    } finally {
        await client.end();
    }
}

export async function storeCachedExample(
    request: EnhanceExampleRequest,
    response: EnhanceExampleResponse
): Promise<void> {
    const connectionDetails = await getConnectionDetails();
    if (!connectionDetails) {
        return;
    }

    const client = new Client({
        ...connectionDetails,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        const hash = computeRequestHash(request);

        const enhancedRequestBuffer = response.enhancedRequestExample
            ? Buffer.from(JSON.stringify(response.enhancedRequestExample), "utf-8")
            : null;
        const enhancedResponseBuffer = response.enhancedResponseExample
            ? Buffer.from(JSON.stringify(response.enhancedResponseExample), "utf-8")
            : null;

        // Upsert using INSERT ... ON CONFLICT
        await client.query(
            `INSERT INTO "CachedEnhancedExample" ("requestHash", "organizationId", "method", "endpointPath", "enhancedRequestExample", "enhancedResponseExample", "modelUsed", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT ("requestHash")
             DO UPDATE SET
                "enhancedRequestExample" = $5,
                "enhancedResponseExample" = $6,
                "modelUsed" = $7`,
            [
                hash,
                request.organizationId,
                request.method,
                request.endpointPath,
                enhancedRequestBuffer,
                enhancedResponseBuffer,
                response.modelUsed
            ]
        );
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("[storeCachedExample] Error storing to cache:", error);
    } finally {
        await client.end();
    }
}
