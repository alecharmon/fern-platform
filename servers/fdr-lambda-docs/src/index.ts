import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import {
    type EnhanceExampleBatchRequest,
    type EnhanceExampleRequest,
    enhanceExample,
    enhanceExamplesBatch
} from "./services/enhanceExample";

// Lambda Function URLs use a different event format than API Gateway
type LambdaEvent = APIGatewayProxyEvent & {
    rawPath?: string;
    requestContext?: {
        http?: {
            method?: string;
        };
    };
};

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

                if (body.endpoints && Array.isArray(body.endpoints)) {
                    const batchRequest = body as EnhanceExampleBatchRequest;

                    if (batchRequest.endpoints.length === 0) {
                        return {
                            statusCode: 400,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*"
                            },
                            body: JSON.stringify({
                                error: "ValidationError",
                                message: "Batch request must contain at least one endpoint",
                                requestId: context.awsRequestId
                            })
                        };
                    }

                    const enhancedResponse = await enhanceExamplesBatch(batchRequest, context.awsRequestId);

                    return {
                        statusCode: 200,
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*"
                        },
                        body: JSON.stringify(enhancedResponse)
                    };
                }

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

                const enhancedResponse = await enhanceExample(singleRequest, context.awsRequestId);

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
