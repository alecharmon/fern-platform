import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Pool } from "pg";
import { type EnhanceExampleRequest, enhanceExample } from "./services/enhanceExample";
import { getCachedExample, getConnectionDetails, storeCachedExample } from "./services/exampleCache";
import { validateCliJwt } from "./utils/jwt";

// Lambda Function URLs use a different event format than API Gateway
type LambdaEvent = APIGatewayProxyEvent & {
    rawPath?: string;
    requestContext?: {
        http?: {
            method?: string;
        };
    };
};

// Create connection pool outside handler for connection reuse
// Pool will be initialized on first use to avoid blocking cold starts
let pool: Pool | null = null;

async function getPool(): Promise<Pool | null> {
    if (pool) {
        return pool;
    }

    const connectionDetails = await getConnectionDetails();
    if (!connectionDetails) {
        return null;
    }

    pool = new Pool({
        host: connectionDetails.host,
        port: connectionDetails.port,
        database: connectionDetails.database,
        user: connectionDetails.user,
        password: connectionDetails.password,
        max: 1, // Lambda best practice: use minimal connections
        idleTimeoutMillis: 120000, // 2 minutes - align with typical Lambda timeout
        connectionTimeoutMillis: 60000, // 60 seconds - enough for RDS Proxy cold start
        ssl: {
            rejectUnauthorized: false
        }
    });

    return pool;
}

export const handler = async (event: LambdaEvent, context: Context): Promise<APIGatewayProxyResult> => {
    // Support both API Gateway and Lambda Function URL formats
    const path = event.path || event.rawPath || "/";
    const method = event.httpMethod || event.requestContext?.http?.method || "GET";

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(`[Handler] ${method} ${path}`);

    try {
        // Route: POST /v2/registry/ai/enhance-example
        if ((path === "/v2/registry/ai/enhance-example" || path === "/ai/enhance-example") && method === "POST") {
            try {
                const body = JSON.parse(event.body || "{}");
                const singleRequest = body as EnhanceExampleRequest;

                if (!singleRequest.method || !singleRequest.endpointPath || !singleRequest.organizationId) {
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

                // Validate JWT authentication
                const authHeader =
                    event.headers?.Authorization ||
                    event.headers?.authorization ||
                    event.headers?.["x-fern-token"] ||
                    event.headers?.["X-Fern-Token"];

                await validateCliJwt(authHeader, singleRequest.organizationId);

                const dbPool = await getPool();
                const cachedResponse = await getCachedExample(singleRequest, dbPool);
                if (cachedResponse) {
                    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                    console.log(`[Handler] Cache HIT for ${singleRequest.method} ${singleRequest.endpointPath}`);
                    cachedResponse.requestId = context.awsRequestId;
                    return {
                        statusCode: 200,
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*"
                        },
                        body: JSON.stringify(cachedResponse)
                    };
                }

                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.log(
                    `[Handler] Cache MISS for ${singleRequest.method} ${singleRequest.endpointPath} - calling OpenAI`
                );

                const enhancedResponse = await enhanceExample(singleRequest, context.awsRequestId);

                await storeCachedExample(singleRequest, enhancedResponse, dbPool);

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

                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
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

        // Route: POST /get-db-examples
        if ((path === "/get-db-examples" || path === "/v2/registry/ai/get-db-examples") && method === "POST") {
            try {
                const body = JSON.parse(event.body || "{}");
                const requests = body as EnhanceExampleRequest[];

                if (!Array.isArray(requests)) {
                    return {
                        statusCode: 400,
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*"
                        },
                        body: JSON.stringify({
                            error: "ValidationError",
                            message: "Request body must be an array of EnhanceExampleRequest objects",
                            requestId: context.awsRequestId
                        })
                    };
                }

                const results = [];
                const dbPool = await getPool();

                for (const request of requests) {
                    const cached = await getCachedExample(request, dbPool);
                    if (cached) {
                        results.push(cached);
                    } else {
                        results.push(null);
                    }
                }

                return {
                    statusCode: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: JSON.stringify({
                        results,
                        requestId: context.awsRequestId
                    })
                };
            } catch (error: unknown) {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.error(`[Handler] Error in get-db-examples:`, error);
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

        // Health check endpoint
        if (path === "/health" && method === "GET") {
            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    status: "healthy",
                    service: "fdr-lambda-docs",
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Default 404 response
        return {
            statusCode: 404,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                error: "NotFound",
                message: `Endpoint not found: ${method} ${path}`,
                requestId: context.awsRequestId
            })
        };
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("Error:", error);

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
