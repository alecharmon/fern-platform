import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import handler after mock is configured
import { handler } from "../index";

// Use vi.hoisted to ensure mock is set up before module imports
const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("pg", () => {
    return {
        Pool: vi.fn(() => ({
            query: mockQuery
        }))
    };
});

describe("Lambda Handler", () => {
    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
        mockQuery.mockReset();
    });

    const createMockEvent = (path: string, method: string, body?: any): APIGatewayProxyEvent => {
        return {
            path,
            httpMethod: method,
            body: body ? JSON.stringify(body) : null,
            headers: {},
            multiValueHeaders: {},
            isBase64Encoded: false,
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: ""
        };
    };

    const createMockContext = (): Context => {
        return {
            callbackWaitsForEmptyEventLoop: false,
            functionName: "test-function",
            functionVersion: "1",
            invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:test",
            memoryLimitInMB: "128",
            awsRequestId: "test-request-id",
            logGroupName: "/aws/lambda/test",
            logStreamName: "test-stream",
            getRemainingTimeInMillis: () => 3000,
            done: () => {},
            fail: () => {},
            succeed: () => {}
        };
    };

    describe("POST /metadata-for-url", () => {
        it("should handle /v2/registry/docs/metadata-for-url path", async () => {
            const mockMetadata = {
                orgID: "test-org",
                isPreview: false,
                domain: "docs.example.com",
                path: "/",
                githubUrl: null
            };

            mockQuery.mockResolvedValueOnce({
                rows: [mockMetadata]
            });

            const event = createMockEvent("/v2/registry/docs/metadata-for-url", "POST", {
                url: "https://docs.example.com"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual({
                url: "https://docs.example.com",
                org: "test-org",
                isPreviewUrl: false
            });
        });

        it("should return metadata for a valid URL", async () => {
            const mockMetadata = {
                orgID: "test-org",
                isPreview: false,
                domain: "docs.example.com",
                path: "/",
                githubUrl: "https://github.com/example/repo"
            };

            mockQuery.mockResolvedValueOnce({
                rows: [mockMetadata]
            });

            const event = createMockEvent("/metadata-for-url", "POST", {
                url: "https://docs.example.com"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual({
                url: "https://docs.example.com",
                org: "test-org",
                isPreviewUrl: false,
                gitUrl: "https://github.com/example/repo"
            });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM "DocsV2"'), ["docs.example.com"]);
        });

        it("should return 404 when domain is not registered", async () => {
            mockQuery.mockResolvedValueOnce({
                rows: []
            });

            const event = createMockEvent("/metadata-for-url", "POST", {
                url: "https://unknown.example.com"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(404);
            expect(JSON.parse(result.body)).toEqual({
                error: "DomainNotRegisteredError",
                message: "Domain not registered",
                requestId: "test-request-id"
            });
        });

        it("should return 400 when url is missing from request body", async () => {
            const event = createMockEvent("/metadata-for-url", "POST", {});
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body)).toEqual({
                message: "Missing required field: url",
                requestId: "test-request-id"
            });
        });

        it("should coerce URL without protocol by adding https://", async () => {
            const mockMetadata = {
                orgID: "test-org",
                isPreview: false,
                domain: "docs.letta.com",
                path: "/",
                githubUrl: null
            };

            mockQuery.mockResolvedValueOnce({
                rows: [mockMetadata]
            });

            const event = createMockEvent("/metadata-for-url", "POST", {
                url: "docs.letta.com"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body)).toEqual({
                url: "docs.letta.com",
                org: "test-org",
                isPreviewUrl: false
            });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM "DocsV2"'), ["docs.letta.com"]);
        });

        it("should coerce URL with http:// protocol", async () => {
            const mockMetadata = {
                orgID: "test-org",
                isPreview: false,
                domain: "docs.example.com",
                path: "/",
                githubUrl: null
            };

            mockQuery.mockResolvedValueOnce({
                rows: [mockMetadata]
            });

            const event = createMockEvent("/metadata-for-url", "POST", {
                url: "http://docs.example.com"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM "DocsV2"'), ["docs.example.com"]);
        });

        it("should handle URL without protocol with path", async () => {
            const mockMetadata = {
                orgID: "test-org",
                isPreview: false,
                domain: "buildwithfern.com",
                path: "/docs",
                githubUrl: null
            };

            mockQuery.mockResolvedValueOnce({
                rows: [mockMetadata]
            });

            const event = createMockEvent("/metadata-for-url", "POST", {
                url: "buildwithfern.com/docs"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM "DocsV2"'), ["buildwithfern.com"]);
        });

        it("should return 400 when url is invalid even after coercion", async () => {
            const event = createMockEvent("/metadata-for-url", "POST", {
                url: "not a valid url at all!!!"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe("InvalidUrlError");
            expect(body.message).toContain("Invalid URL");
            expect(body.requestId).toBe("test-request-id");
        });

        it("should handle metadata without githubUrl", async () => {
            const mockMetadata = {
                orgID: "test-org",
                isPreview: true,
                domain: "preview.example.com",
                path: "/preview",
                githubUrl: null
            };

            mockQuery.mockResolvedValueOnce({
                rows: [mockMetadata]
            });

            const event = createMockEvent("/metadata-for-url", "POST", {
                url: "https://preview.example.com/preview"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.gitUrl).toBeUndefined();
            expect(body.isPreviewUrl).toBe(true);
        });
    });

    describe("Default route", () => {
        it("should return database counts for default route", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ count: "42" }] })
                .mockResolvedValueOnce({ rows: [{ count: "100" }] });

            const event = createMockEvent("/", "GET");
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.database.apiDefinitionsCount).toBe(42);
            expect(body.database.docsCount).toBe(100);
        });
    });

    describe("Error handling", () => {
        it("should return 500 on database error", async () => {
            mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

            const event = createMockEvent("/", "GET");
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(500);
            expect(JSON.parse(result.body)).toEqual({
                message: "Error processing request",
                error: "Database connection failed",
                requestId: "test-request-id"
            });
        });
    });
});
