import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Pool } from "pg";
import { DomainNotRegisteredError, InvalidUrlError, UnauthorizedError, UserNotInOrgError } from "./errors";
import { getDocsForUrl } from "./services/getDocsForUrl";
import { getMetadataForUrl } from "./services/getMetadataForUrl";
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

interface GetMetadataForUrlRequest {
    url: string;
}

interface LoadDocsForUrlRequest {
    url: string;
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

            const metadata = await getMetadataForUrl(body.url, pool);

            if (metadata === null) {
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

        // Route: POST /v2/registry/docs/load-docs-for-url or POST /load-docs-for-url
        if ((path === "/v2/registry/docs/load-docs-for-url" || path === "/load-docs-for-url") && method === "POST") {
            console.log(`[Handler] load-docs-for-url endpoint called, requestId: ${context.awsRequestId}`);

            const body: LoadDocsForUrlRequest = JSON.parse(event.body || "{}");
            console.log(`[Handler] Parsed request body, url: ${body.url}`);

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

            // Parse the URL
            console.log(`[Handler] Parsing URL: ${body.url}`);
            let parsedUrl: URL;
            try {
                let urlWithProtocol = body.url;
                if (!/^https?:\/\//i.test(body.url)) {
                    urlWithProtocol = "https://" + body.url;
                }
                parsedUrl = new URL(urlWithProtocol);
                console.log(`[Handler] URL parsed successfully: ${parsedUrl.hostname}`);
            } catch (error) {
                throw new InvalidUrlError(body.url, error as Error);
            }

            // Extract Authorization header (case-insensitive)
            const authHeader =
                event.headers?.Authorization ||
                event.headers?.authorization ||
                event.headers?.["x-fern-token"] ||
                event.headers?.["X-Fern-Token"];
            console.log(`[Handler] Authorization header present: ${!!authHeader}`);

            console.log(`[Handler] Calling getDocsForUrl for domain: ${parsedUrl.hostname}`);
            const docsResponse = await getDocsForUrl(parsedUrl, pool, authHeader);
            console.log(`[Handler] getDocsForUrl completed successfully, preparing response`);

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify(docsResponse)
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
