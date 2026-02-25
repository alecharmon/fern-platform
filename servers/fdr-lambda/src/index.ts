import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Pool } from "pg";
import {
    ApiDoesNotExistError,
    DomainNotRegisteredError,
    InvalidUrlError,
    UnauthorizedError,
    UserNotInOrgError
} from "./errors";
import { getApiDefinition } from "./services/getApiDefinition";
import { getMetadataForUrl } from "./services/getMetadataForUrl";
import { verifyDocsServiceJWT } from "./utils/jwt";
import { initializeS3 } from "./utils/s3";

// Create connection pool outside handler for connection reuse
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // Lambda best practice: use minimal connections
    idleTimeoutMillis: 120000, // 2 minutes - align with typical Lambda timeout
    connectionTimeoutMillis: 60000 // 60 seconds - enough for RDS Proxy cold start
});

// Initialize S3 with environment variables
// Note: AWS credentials are not provided - Lambda will use its IAM role
initializeS3({
    publicDocsCDNUrl: process.env.PUBLIC_DOCS_CDN_URL || "",
    publicDocsS3BucketName: process.env.PUBLIC_DOCS_S3_BUCKET_NAME || "",
    publicDocsS3BucketRegion: process.env.PUBLIC_DOCS_S3_BUCKET_REGION || "us-east-1",
    privateDocsS3BucketName: process.env.PRIVATE_DOCS_S3_BUCKET_NAME || "",
    privateDocsS3BucketRegion: process.env.PRIVATE_DOCS_S3_BUCKET_REGION || "us-east-1",
    dbDocsDefinitionS3BucketName: process.env.DB_DOCS_DEFINITION_BUCKET_NAME || "",
    dbDocsDefinitionS3BucketRegion: process.env.DB_DOCS_DEFINITION_BUCKET_REGION || "us-east-1"
});

// Create S3 client for deleting fdr.json files
const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1"
});

interface GetMetadataForUrlRequest {
    url: string;
    basepath?: string;
}

async function deleteDocsSite(url: string, authHeader: string | undefined): Promise<void> {
    let parsedUrl: URL;
    try {
        let urlWithProtocol = url;
        if (!/^https?:\/\//i.test(url)) {
            urlWithProtocol = "https://" + url;
        }
        parsedUrl = new URL(urlWithProtocol);
    } catch (error) {
        throw new InvalidUrlError(url, error as Error);
    }
    const hostname = parsedUrl.hostname;

    const result = await pool.query(`SELECT "domain", "orgID" FROM "DocsV2" WHERE "domain" = $1 LIMIT 1`, [hostname]);

    if (result.rows.length === 0) {
        throw new DomainNotRegisteredError();
    }

    // Verify the service JWT from docs-server
    await verifyDocsServiceJWT(authHeader);

    const bucketName = process.env.DB_DOCS_DEFINITION_BUCKET_NAME;
    if (!bucketName) {
        throw new Error("DB_DOCS_DEFINITION_BUCKET_NAME environment variable is not set");
    }

    const isLocalMode = process.env.LOCAL_MODE_OVERRIDE === "true";
    const s3Key = isLocalMode ? "v1/fdr.json" : `${hostname}/v1/fdr.json`;

    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: bucketName,
                Key: s3Key
            })
        );
        console.log(`Successfully deleted S3 object: ${s3Key} from bucket: ${bucketName}`);
    } catch (error) {
        console.error(`Failed to delete S3 object: ${s3Key}`, error);
        throw error;
    }

    await pool.query(`DELETE FROM "DocsV2" WHERE "domain" = $1`, [hostname]);
    console.log(`Successfully deleted docs site for domain: ${hostname}`);
}

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    console.log("Event:", JSON.stringify(event, null, 2));
    console.log("Context:", JSON.stringify(context, null, 2));

    const path = event.path;
    const method = event.httpMethod;

    try {
        // Route: POST /v2/registry/docs/metadata-for-url or POST /metadata-for-url
        if ((path === "/v2/registry/docs/metadata-for-url" || path === "/metadata-for-url") && method === "POST") {
            const body: GetMetadataForUrlRequest = JSON.parse(event.body || "{}");

            if (!body.url) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify({
                        message: "Missing required field: url",
                        requestId: context.awsRequestId
                    })
                };
            }

            console.log(
                `[Handler] metadata-for-url: url=${body.url}${body.basepath != null ? `, basepath=${body.basepath}` : ", no basepath"}`
            );

            const metadata = await getMetadataForUrl(body.url, pool, body.basepath);

            if (metadata === null) {
                console.warn(
                    `[Handler] metadata-for-url returned null for url=${body.url}${body.basepath != null ? `, basepath=${body.basepath}` : ""}`
                );
                throw new DomainNotRegisteredError();
            }

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify(metadata)
            };
        }

        // Route: POST /v2/registry/docs/delete or POST /delete
        if ((path === "/v2/registry/docs/delete" || path === "/delete") && method === "POST") {
            const body: { url: string } = JSON.parse(event.body || "{}");

            if (!body.url) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify({
                        message: "Missing required field: url",
                        requestId: context.awsRequestId
                    })
                };
            }

            const authHeader =
                event.headers?.Authorization ||
                event.headers?.authorization ||
                event.headers?.["x-fern-token"] ||
                event.headers?.["X-Fern-Token"];

            await deleteDocsSite(body.url, authHeader);

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Successfully deleted docs site",
                    requestId: context.awsRequestId
                })
            };
        }

        // Route: GET /registry/api/load-full/{apiDefinitionId}
        if (path.startsWith("/registry/api/load-full/") && method === "GET") {
            const pathParts = path.split("/");
            const apiDefinitionId = pathParts[4];

            if (!apiDefinitionId) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify({
                        message: "Missing apiDefinitionId",
                        requestId: context.awsRequestId
                    })
                };
            }

            const apiDefinition = await getApiDefinition(apiDefinitionId, pool);

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify(apiDefinition)
            };
        }

        // Default route for testing
        const apiDefinitionsResult = await pool.query('SELECT COUNT(*) FROM "ApiDefinitionsV2"');
        const docsResult = await pool.query('SELECT COUNT(*) FROM "Docs"');

        const apiDefinitionsCount = parseInt(apiDefinitionsResult.rows[0].count);
        const docsCount = parseInt(docsResult.rows[0].count);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Hello World from fdr-lambda!",
                timestamp: new Date().toISOString(),
                requestId: context.awsRequestId,
                database: {
                    apiDefinitionsCount,
                    docsCount
                }
            })
        };
    } catch (error) {
        console.error("Error:", error);

        // Handle InvalidUrlError
        if (error instanceof InvalidUrlError) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    error: "InvalidUrlError",
                    message: error.message,
                    requestId: context.awsRequestId
                })
            };
        }

        // Handle DomainNotRegisteredError
        if (error instanceof DomainNotRegisteredError) {
            return {
                statusCode: 404,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    error: "DomainNotRegisteredError",
                    message: "Domain not registered",
                    requestId: context.awsRequestId
                })
            };
        }

        // Handle UnauthorizedError
        if (error instanceof UnauthorizedError) {
            return {
                statusCode: 401,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    error: "UnauthorizedError",
                    message: error.message,
                    requestId: context.awsRequestId
                })
            };
        }

        // Handle UserNotInOrgError
        if (error instanceof UserNotInOrgError) {
            return {
                statusCode: 403,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    error: "UserNotInOrgError",
                    message: error.message,
                    requestId: context.awsRequestId
                })
            };
        }

        // Handle ApiDoesNotExistError
        if (error instanceof ApiDoesNotExistError) {
            return {
                statusCode: 404,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    error: "ApiDoesNotExistError",
                    message: error.message,
                    requestId: context.awsRequestId
                })
            };
        }

        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Error processing request",
                error: error instanceof Error ? error.message : String(error),
                requestId: context.awsRequestId
            })
        };
    }
};
