import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import express from "express";
import { handler } from "./index.js";

const app = express();
const PORT = 8081;

// Parse JSON body
app.use(express.json());

// Create a mock Lambda context
function createMockContext(): Context {
    return {
        awsRequestId: `local-${Date.now()}`,
        functionName: "fdr-lambda-local",
        functionVersion: "$LATEST",
        invokedFunctionArn: "arn:aws:lambda:local:000000000000:function:fdr-lambda-local",
        memoryLimitInMB: "512",
        logGroupName: "/aws/lambda/fdr-lambda-local",
        logStreamName: "local-stream",
        callbackWaitsForEmptyEventLoop: false,
        getRemainingTimeInMillis: () => 300000,
        done: () => {},
        fail: () => {},
        succeed: () => {}
    };
}

// Generic handler for all routes - use use() instead of all() for catch-all
app.use(async (req, res) => {
    try {
        // Convert Express request to APIGatewayProxyEvent
        const event: APIGatewayProxyEvent = {
            httpMethod: req.method,
            path: req.path,
            headers: req.headers as Record<string, string>,
            queryStringParameters: req.query as Record<string, string> | null,
            body: req.body ? JSON.stringify(req.body) : null,
            isBase64Encoded: false,
            pathParameters: null,
            stageVariables: null,
            requestContext: {
                accountId: "local",
                apiId: "local",
                protocol: "HTTP/1.1",
                httpMethod: req.method,
                path: req.path,
                stage: "local",
                requestId: `local-${Date.now()}`,
                requestTime: new Date().toISOString(),
                requestTimeEpoch: Date.now(),
                identity: {
                    accessKey: null,
                    accountId: null,
                    apiKey: null,
                    apiKeyId: null,
                    caller: null,
                    clientCert: null,
                    cognitoAuthenticationProvider: null,
                    cognitoAuthenticationType: null,
                    cognitoIdentityId: null,
                    cognitoIdentityPoolId: null,
                    principalOrgId: null,
                    sourceIp: req.ip || "127.0.0.1",
                    user: null,
                    userAgent: req.get("user-agent") || null,
                    userArn: null
                },
                authorizer: null,
                domainName: "localhost",
                domainPrefix: "local",
                resourceId: "local",
                resourcePath: req.path
            },
            resource: req.path,
            multiValueHeaders: {},
            multiValueQueryStringParameters: null
        };

        const context = createMockContext();

        // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

        // Call the Lambda handler
        const result = await handler(event, context);

        // Convert Lambda response to Express response
        res.status(result.statusCode);

        // Set headers
        if (result.headers) {
            Object.entries(result.headers).forEach(([key, value]) => {
                res.setHeader(key, value as string);
            });
        }

        // Send body
        if (result.body) {
            try {
                const body = JSON.parse(result.body);
                res.json(body);
            } catch {
                res.send(result.body);
            }
        } else {
            res.end();
        }
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
        console.error("Error processing request:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

app.listen(PORT, () => {
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.debug(`\n🚀 FDR Lambda local server running on http://localhost:${PORT}`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`\nAvailable endpoints:`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  POST http://localhost:${PORT}/v2/registry/ai/enhance-example`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  POST http://localhost:${PORT}/v2/registry/docs/load-docs-for-url`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  POST http://localhost:${PORT}/v2/registry/docs/metadata-for-url`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  POST http://localhost:${PORT}/v2/registry/docs/delete`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  POST http://localhost:${PORT}/v2/registry/docs/ensure-docs-in-s3`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  GET  http://localhost:${PORT}/v2/registry/api/load-full/{apiDefinitionId}`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  GET  http://localhost:${PORT}/v2/registry/api/load/{apiDefinitionId}/endpoint/{endpointId}`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  GET  http://localhost:${PORT}/v2/registry/api/load/{apiDefinitionId}/endpoint?method=X&path=Y`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`  POST http://localhost:${PORT}/v2/registry/docs/load-fields`);
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`\n💡 Make sure your local FDR server is running on port 8080\n`);
});
