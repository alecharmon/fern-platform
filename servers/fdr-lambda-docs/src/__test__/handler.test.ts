import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { handler } from "../index";

describe("fdr-lambda-docs handler", () => {
    const mockContext = {
        awsRequestId: "test-request-id",
        functionName: "test-function",
        functionVersion: "1",
        invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:test",
        memoryLimitInMB: "512",
        logGroupName: "/aws/lambda/test",
        logStreamName: "2023/01/01/[$LATEST]test",
        getRemainingTimeInMillis: () => 30000,
        callbackWaitsForEmptyEventLoop: true,
        done: () => {},
        fail: () => {},
        succeed: () => {}
    } as Context;

    it("should return 404 for unknown routes", async () => {
        const event = {
            httpMethod: "GET",
            path: "/unknown",
            headers: {},
            body: null
        } as APIGatewayProxyEvent;

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toMatchObject({
            error: "NotFound"
        });
    });

    it("should return 200 for health endpoint", async () => {
        const event = {
            httpMethod: "GET",
            path: "/health",
            headers: {},
            body: null
        } as APIGatewayProxyEvent;

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toMatchObject({
            status: "healthy",
            service: "fdr-lambda-docs"
        });
    });

    it("should return 400 for enhance-example with missing fields", async () => {
        const event = {
            httpMethod: "POST",
            path: "/ai/enhance-example",
            headers: {},
            body: JSON.stringify({})
        } as APIGatewayProxyEvent;

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toMatchObject({
            error: "ValidationError",
            message: "Missing required fields: method, endpointPath, and organizationId"
        });
    });
});
