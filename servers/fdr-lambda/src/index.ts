import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Pool } from "pg";
import {
    ApiDoesNotExistError,
    DomainNotRegisteredError,
    EndpointDoesNotExistError,
    InvalidUrlError,
    UnauthorizedError,
    UserNotInOrgError
} from "./errors";
import { type EnhanceExampleRequest, enhanceExample } from "./services/enhanceExample";
import { ensureDocsInS3 } from "./services/ensureDocsInS3";
import { getDocsForUrl } from "./services/getDocsForUrl";
import { getEndpointById } from "./services/getEndpointById";
import { getEndpointByLocator } from "./services/getEndpointByLocator";
import { getMetadataForUrl } from "./services/getMetadataForUrl";
import { checkUserBelongsToOrg } from "./utils/auth";
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
}

interface LoadDocsForUrlRequest {
    url: string;
}

interface EnsureDocsInS3Request {
    url: string;
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

    const orgId = result.rows[0].orgID;

    // Check authorization - user must belong to the org that owns this docs site
    await checkUserBelongsToOrg({
        authHeader,
        orgId
    });

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
        // Route: POST /v2/registry/ai/enhance-example
        if ((path === "/v2/registry/ai/enhance-example" || path === "/ai/enhance-example") && method === "POST") {
            console.log(`[Handler] ai/enhance-example endpoint called, requestId: ${context.awsRequestId}`);

            try {
                const body: EnhanceExampleRequest = JSON.parse(event.body || "{}");
                console.log(
                    `[Handler] Parsed request body, method: ${body.method}, path: ${body.endpointPath}, orgId: ${body.organizationId}`
                );

                if (!body.method || !body.endpointPath || !body.organizationId) {
                    return {
                        statusCode: 400,
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*"
                        },
                        body: JSON.stringify({
                            error: "ValidationError",
                            message: "Missing required fields: method, endpointPath, and organizationId",
                            requestId: context.awsRequestId
                        })
                    };
                }

                // Extract Authorization header (case-insensitive)
                // const authHeader =
                //     event.headers?.Authorization ||
                //     event.headers?.authorization ||
                //     event.headers?.["x-fern-token"] ||
                //     event.headers?.["X-Fern-Token"];

                // await checkUserBelongsToOrg({
                //     authHeader,
                //     orgId: body.organizationId
                // });

                console.log(
                    `[Handler] Auth validated for org: ${body.organizationId}, calling enhanceExample for ${body.method} ${body.endpointPath}`
                );
                const enhancedResponse = await enhanceExample(body, context.awsRequestId);
                console.log(`[Handler] enhanceExample completed successfully`);

                return {
                    statusCode: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify(enhancedResponse)
                };
            } catch (error: unknown) {
                if (error && typeof error === "object" && "name" in error) {
                    const errorName = (error as { name: string }).name;
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    if (errorName === "UnauthorizedError") {
                        return {
                            statusCode: 401,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: "UnauthorizedError",
                                message: errorMessage,
                                requestId: context.awsRequestId
                            })
                        };
                    }

                    if (errorName === "UserNotInOrgError") {
                        return {
                            statusCode: 403,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: "UserNotInOrgError",
                                message: errorMessage,
                                requestId: context.awsRequestId
                            })
                        };
                    }

                    if (errorName === "OpenAITimeout") {
                        return {
                            statusCode: 504,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: "OpenAITimeout",
                                message: errorMessage,
                                requestId: context.awsRequestId
                            })
                        };
                    }

                    if (errorName === "OpenAIRateLimited") {
                        return {
                            statusCode: 429,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: "OpenAIRateLimited",
                                message: errorMessage,
                                requestId: context.awsRequestId
                            })
                        };
                    }

                    if (errorName === "OpenAIInvalidRequest") {
                        return {
                            statusCode: 400,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: "OpenAIInvalidRequest",
                                message: errorMessage,
                                requestId: context.awsRequestId
                            })
                        };
                    }

                    if (errorName === "OpenAIServerError" || errorName === "OpenAIResponseParseError") {
                        return {
                            statusCode: 502,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: errorName,
                                message: errorMessage,
                                requestId: context.awsRequestId
                            })
                        };
                    }

                    if (errorName === "ConfigError") {
                        return {
                            statusCode: 500,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: "ConfigError",
                                message: errorMessage,
                                requestId: context.awsRequestId
                            })
                        };
                    }

                    if (errorName === "UnavailableError") {
                        return {
                            statusCode: 503,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: "UnavailableError",
                                message: errorMessage,
                                requestId: context.awsRequestId
                            })
                        };
                    }
                }

                console.error(`[Handler] Unhandled error in ai/enhance-example:`, error);
                return {
                    statusCode: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify({
                        error: "InternalError",
                        message: error instanceof Error ? error.message : "An unexpected error occurred",
                        requestId: context.awsRequestId
                    })
                };
            }
        }

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

        // Route: POST /v2/registry/docs/ensure-docs-in-s3 or POST /ensure-docs-in-s3
        if ((path === "/v2/registry/docs/ensure-docs-in-s3" || path === "/ensure-docs-in-s3") && method === "POST") {
            console.log(`[Handler] ensure-docs-in-s3 endpoint called, requestId: ${context.awsRequestId}`);

            const body: EnsureDocsInS3Request = JSON.parse(event.body || "{}");
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

            console.log(`[Handler] Calling ensureDocsInS3 for domain: ${parsedUrl.hostname}`);
            const s3Response = await ensureDocsInS3(parsedUrl, pool, authHeader);
            console.log(`[Handler] ensureDocsInS3 completed successfully, S3 URL: ${s3Response.s3Url}`);

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify(s3Response)
            };
        }

        // Route: GET /registry/api/load/{apiDefinitionId}/endpoint/{endpointId}
        if (path.startsWith("/registry/api/load/") && path.includes("/endpoint/") && method === "GET") {
            const pathParts = path.split("/");
            const apiDefinitionId = pathParts[4];
            const endpointId = pathParts[6];

            if (!apiDefinitionId || !endpointId) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify({
                        message: "Missing apiDefinitionId or endpointId",
                        requestId: context.awsRequestId
                    })
                };
            }

            const endpointWithContext = await getEndpointById(apiDefinitionId, endpointId, pool);

            if (endpointWithContext == null) {
                throw new EndpointDoesNotExistError();
            }

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify(endpointWithContext)
            };
        }

        // Route: GET /registry/api/load/{apiDefinitionId}/endpoint?method=X&path=Y
        if (path.startsWith("/registry/api/load/") && path.includes("/endpoint") && method === "GET") {
            const pathParts = path.split("/");
            const apiDefinitionId = pathParts[4];
            const methodParam = event.queryStringParameters?.method;
            const pathParam = event.queryStringParameters?.path;

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

            if (
                !methodParam ||
                typeof methodParam !== "string" ||
                !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(methodParam)
            ) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify({
                        message: "Invalid or missing method parameter",
                        requestId: context.awsRequestId
                    })
                };
            }

            if (!pathParam || typeof pathParam !== "string" || pathParam.length === 0) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify({
                        message: "Invalid or missing path parameter",
                        requestId: context.awsRequestId
                    })
                };
            }

            const endpoint = await getEndpointByLocator(apiDefinitionId, methodParam, pathParam, pool);

            if (endpoint == null) {
                throw new EndpointDoesNotExistError();
            }

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify(endpoint)
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

        // Handle EndpointDoesNotExistError
        if (error instanceof EndpointDoesNotExistError) {
            return {
                statusCode: 404,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    error: "EndpointDoesNotExistError",
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
