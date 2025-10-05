import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Pool } from "pg";

// Create connection pool outside handler for connection reuse
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // Lambda best practice: use minimal connections
    idleTimeoutMillis: 120000, // 2 minutes - align with typical Lambda timeout
    connectionTimeoutMillis: 60000 // 60 seconds - enough for RDS Proxy cold start
});

interface DocsUrlMetadata {
    url: string;
    org: string;
    isPreviewUrl: boolean;
    gitUrl?: string;
}

interface GetMetadataForUrlRequest {
    url: string;
}

class DomainNotRegisteredError extends Error {
    constructor() {
        super("Domain not registered");
        this.name = "DomainNotRegisteredError";
    }
}

class InvalidUrlError extends Error {
    constructor(url: string, originalError: Error) {
        super(`Invalid URL: ${url}`);
        this.name = "InvalidUrlError";
        this.cause = originalError;
    }
}

async function getMetadataForUrl(url: string): Promise<DocsUrlMetadata | null> {
    // Parse the URL to get the hostname
    // Coerce URL by adding https:// prefix if missing (similar to ParsedBaseUrl in FDR)
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

    // Query the database for the docs metadata
    const result = await pool.query(
        `SELECT "orgID", "isPreview", "domain", "path", "githubUrl"
     FROM "DocsV2"
     WHERE "domain" = $1
     ORDER BY "updatedTime" DESC
     LIMIT 1`,
        [hostname]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    return {
        url,
        org: row.orgID,
        isPreviewUrl: row.isPreview,
        gitUrl: row.githubUrl ?? undefined
    };
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

            const metadata = await getMetadataForUrl(body.url);

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
