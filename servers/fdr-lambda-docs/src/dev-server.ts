import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { handler } from "./index";

const PORT = process.env.PORT || 3456;

// Parse request body
async function parseBody(req: IncomingMessage): Promise<string | null> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
            if (chunks.length === 0) {
                resolve(null);
            } else {
                resolve(Buffer.concat(chunks).toString());
            }
        });
        req.on("error", () => resolve(null));
    });
}

// Convert Node.js request to Lambda event format
function createLambdaEvent(req: IncomingMessage, body: string | null): APIGatewayProxyEvent {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });

    return {
        httpMethod: req.method || "GET",
        path: url.pathname,
        headers: req.headers as Record<string, string>,
        queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : null,
        body,
        isBase64Encoded: false,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
            accountId: "local",
            apiId: "local",
            authorizer: null,
            protocol: "HTTP/1.1",
            httpMethod: req.method || "GET",
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
                sourceIp: req.socket.remoteAddress || "127.0.0.1",
                user: null,
                userAgent: req.headers["user-agent"] || null,
                userArn: null
            },
            path: url.pathname,
            stage: "local",
            requestId: `local-${Date.now()}`,
            requestTimeEpoch: Date.now(),
            resourceId: "local",
            resourcePath: url.pathname
        },
        resource: url.pathname,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null
    } as APIGatewayProxyEvent;
}

const mockContext: Context = {
    awsRequestId: `local-${Date.now()}`,
    functionName: "fdr-lambda-docs-local",
    functionVersion: "1",
    invokedFunctionArn: "arn:aws:lambda:local:123456789012:function:fdr-lambda-docs",
    memoryLimitInMB: "512",
    logGroupName: "/aws/lambda/fdr-lambda-docs-local",
    logStreamName: "local",
    getRemainingTimeInMillis: () => 30000,
    callbackWaitsForEmptyEventLoop: true,
    done: () => {},
    fail: () => {},
    succeed: () => {}
};

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
        const body = await parseBody(req);
        const event = createLambdaEvent(req, body);
        const result = await handler(event, mockContext);

        res.statusCode = result.statusCode;

        if (result.headers) {
            for (const [key, value] of Object.entries(result.headers)) {
                if (value !== undefined) {
                    res.setHeader(key, String(value));
                }
            }
        }

        res.end(result.body);
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
        console.error("Error handling request:", error);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
            JSON.stringify({
                error: "InternalError",
                message: error instanceof Error ? error.message : "Unknown error"
            })
        );
    }
});

server.listen(PORT, () => {
    // biome-ignore lint/suspicious/noConsole: console output is intentional for dev server
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           fdr-lambda-docs Dev Server                           ║
╠════════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                      ║
╠════════════════════════════════════════════════════════════════╣
║  Available endpoints:                                          ║
║                                                                ║
║  GET  /health              - Health check                      ║
║  GET  /docs-score?domain=  - Get docs score for domain         ║
║  POST /docs-score          - Trigger docs score calculation    ║
║       Body: { "domain": "example.com" }                        ║
╠════════════════════════════════════════════════════════════════╣
║  Example usage:                                                ║
║                                                                ║
║  curl http://localhost:${PORT}/health                             ║
║                                                                ║
║  curl -X POST http://localhost:${PORT}/docs-score \\               ║
║       -H "Content-Type: application/json" \\                   ║
║       -d '{"domain": "buildwithfern.com"}'                     ║
╚════════════════════════════════════════════════════════════════╝
`);
});
