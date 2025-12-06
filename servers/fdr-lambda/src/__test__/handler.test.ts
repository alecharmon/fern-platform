import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Set up JWT_SECRET_KEY for tests before any imports that might use it
const TEST_JWT_SECRET = "test-jwt-secret-key-for-testing";
const encoder = new TextEncoder();

// Helper to sign a valid service JWT for tests
async function signTestServiceJwt(): Promise<string> {
    return new SignJWT({ service: "docs-server", scope: "fdr:docs-fields" })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .setIssuer("https://buildwithfern.com")
        .setAudience("fdr-lambda")
        .sign(encoder.encode(TEST_JWT_SECRET));
}

// Helper to sign an invalid service JWT (wrong service claim)
async function signInvalidServiceJwt(): Promise<string> {
    return new SignJWT({ service: "wrong-service", scope: "fdr:docs-fields" })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .setIssuer("https://buildwithfern.com")
        .setAudience("fdr-lambda")
        .sign(encoder.encode(TEST_JWT_SECRET));
}

// Use vi.hoisted to ensure mocks are set up before module imports
const mockQuery = vi.hoisted(() => vi.fn());
const mockGetPresignedUrl = vi.hoisted(() => vi.fn());
const mockGetDocsDefinitionFromS3 = vi.hoisted(() => vi.fn());
const mockIsMember = vi.hoisted(() => vi.fn());

vi.mock("pg", () => {
    return {
        Pool: vi.fn(() => ({
            query: mockQuery
        }))
    };
});

vi.mock("../utils/s3", () => ({
    initializeS3: vi.fn(),
    getPresignedDocsAssetsDownloadUrl: mockGetPresignedUrl,
    getDocsDefinitionFromS3: mockGetDocsDefinitionFromS3
}));

vi.mock("@fern-api/venus-api-sdk", () => ({
    FernVenusApiClient: vi.fn(() => ({
        organization: {
            isMember: mockIsMember
        }
    })),
    FernVenusApi: {
        OrganizationId: (id: string) => id
    }
}));

// Import handler after mocks are configured
import { handler } from "../index";

describe("Lambda Handler", () => {
    beforeAll(() => {
        // Set JWT_SECRET_KEY for JWT verification in tests
        process.env.JWT_SECRET_KEY = TEST_JWT_SECRET;
    });

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
        mockQuery.mockReset();
        mockGetPresignedUrl.mockReset();
        mockGetDocsDefinitionFromS3.mockReset();
        mockIsMember.mockReset();
        // Default S3 mock to return a URL
        mockGetPresignedUrl.mockResolvedValue("https://s3.example.com/file.png");
        // Default getDocsDefinitionFromS3 mock to return null (fall back to database)
        mockGetDocsDefinitionFromS3.mockResolvedValue(null);
        // Default Venus mock to allow access (member of fern org) - kept for backwards compatibility
        mockIsMember.mockResolvedValue({ ok: true, body: true });
        // Set VENUS_URL for tests - kept for backwards compatibility
        process.env.VENUS_URL = "https://venus.buildwithfern.com";
    });

    const createMockEvent = (
        path: string,
        method: string,
        body?: any,
        headers?: Record<string, string>
    ): APIGatewayProxyEvent => {
        return {
            path,
            httpMethod: method,
            body: body ? JSON.stringify(body) : null,
            headers: headers || {},
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

            mockQuery
                .mockResolvedValueOnce({
                    rows: [mockMetadata]
                })
                .mockResolvedValueOnce({
                    rows: []
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
                isPreviewUrl: false,
                enableAlgoliaOnPreview: false
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

            mockQuery
                .mockResolvedValueOnce({
                    rows: [mockMetadata]
                })
                .mockResolvedValueOnce({
                    rows: [{ domain: "docs.example.com" }]
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
                gitUrl: "https://github.com/example/repo",
                enableAlgoliaOnPreview: true
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

            mockQuery
                .mockResolvedValueOnce({
                    rows: [mockMetadata]
                })
                .mockResolvedValueOnce({
                    rows: []
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
                isPreviewUrl: false,
                enableAlgoliaOnPreview: false
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

            mockQuery
                .mockResolvedValueOnce({
                    rows: [mockMetadata]
                })
                .mockResolvedValueOnce({
                    rows: []
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

            mockQuery
                .mockResolvedValueOnce({
                    rows: [mockMetadata]
                })
                .mockResolvedValueOnce({
                    rows: []
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

            mockQuery
                .mockResolvedValueOnce({
                    rows: [mockMetadata]
                })
                .mockResolvedValueOnce({
                    rows: []
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
            expect(body.enableAlgoliaOnPreview).toBe(false);
        });
    });

    describe("POST /load-docs-for-url", () => {
        it("should return docs for a valid URL with auth", async () => {
            const mockDocsDefinition = Buffer.from(
                JSON.stringify({
                    type: "v3",
                    pages: {},
                    config: {
                        navigation: { items: [] },
                        colorsV3: { type: "light" }
                    },
                    files: {
                        "file-1": {
                            type: "url",
                            s3Key: "test/file.png"
                        }
                    },
                    referencedApis: []
                })
            );

            // Mock DocsV2 query
            mockQuery
                .mockResolvedValueOnce({
                    rows: [
                        {
                            orgID: "test-org",
                            domain: "docs.example.com",
                            path: "",
                            docsDefinition: mockDocsDefinition,
                            docsConfigInstanceId: "config-123",
                            authType: "PUBLIC",
                            hasPublicS3Assets: true
                        }
                    ]
                })
                // Mock empty API definitions queries
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            // Use a valid service JWT instead of a plain token
            const validJwt = await signTestServiceJwt();
            const event = createMockEvent(
                "/load-docs-for-url",
                "POST",
                {
                    url: "https://docs.example.com"
                },
                {
                    Authorization: `Bearer ${validJwt}`
                }
            );
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.orgId).toBe("test-org");
            expect(body.baseUrl.domain).toBe("docs.example.com");
            expect(body.definition).toBeDefined();
        });

        it("should handle /v2/registry/docs/load-docs-for-url path", async () => {
            const mockDocsDefinition = Buffer.from(
                JSON.stringify({
                    type: "v3",
                    pages: {},
                    config: {
                        navigation: { items: [] },
                        colorsV3: { type: "dark" }
                    },
                    files: {},
                    referencedApis: []
                })
            );

            mockQuery
                .mockResolvedValueOnce({
                    rows: [
                        {
                            orgID: "test-org-2",
                            domain: "docs.test.com",
                            path: "/api",
                            docsDefinition: mockDocsDefinition,
                            docsConfigInstanceId: null,
                            authType: "PUBLIC",
                            hasPublicS3Assets: false
                        }
                    ]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            // Use a valid service JWT instead of a plain token
            const validJwt = await signTestServiceJwt();
            const event = createMockEvent(
                "/v2/registry/docs/load-docs-for-url",
                "POST",
                {
                    url: "docs.test.com"
                },
                {
                    Authorization: `Bearer ${validJwt}`
                }
            );
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.orgId).toBe("test-org-2");
            expect(body.baseUrl.domain).toBe("docs.test.com");
            expect(body.baseUrl.basePath).toBe("/api");
            expect(body.lightModeEnabled).toBe(false);
        });

        it("should return 400 when url is missing", async () => {
            const event = createMockEvent("/load-docs-for-url", "POST", {});
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(400);
            expect(JSON.parse(result.body)).toEqual({
                message: "Missing required field: url",
                requestId: "test-request-id"
            });
        });

        it("should return 400 for invalid URL", async () => {
            const event = createMockEvent("/load-docs-for-url", "POST", {
                url: "not a valid url!!!"
            });
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(400);
            const body = JSON.parse(result.body);
            expect(body.error).toBe("InvalidUrlError");
        });

        it("should return 401 when authorization header is missing", async () => {
            const mockDocsDefinition = Buffer.from(
                JSON.stringify({
                    type: "v3",
                    pages: {},
                    config: {
                        navigation: { items: [] },
                        colorsV3: { type: "light" }
                    },
                    files: {},
                    referencedApis: []
                })
            );

            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        orgID: "test-org",
                        domain: "docs.example.com",
                        path: "",
                        docsDefinition: mockDocsDefinition,
                        docsConfigInstanceId: "config-123",
                        authType: "PUBLIC",
                        hasPublicS3Assets: true
                    }
                ]
            });

            const event = createMockEvent("/load-docs-for-url", "POST", {
                url: "https://docs.example.com"
            }); // No auth header
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body).error).toBe("UnauthorizedError");
        });

        it("should return 401 when JWT has invalid service claim", async () => {
            const mockDocsDefinition = Buffer.from(
                JSON.stringify({
                    type: "v3",
                    pages: {},
                    config: {
                        navigation: { items: [] },
                        colorsV3: { type: "light" }
                    },
                    files: {},
                    referencedApis: []
                })
            );

            mockQuery.mockResolvedValueOnce({
                rows: [
                    {
                        orgID: "test-org",
                        domain: "docs.example.com",
                        path: "",
                        docsDefinition: mockDocsDefinition,
                        docsConfigInstanceId: "config-123",
                        authType: "PUBLIC",
                        hasPublicS3Assets: true
                    }
                ]
            });

            // Use a JWT with wrong service claim
            const invalidJwt = await signInvalidServiceJwt();
            const event = createMockEvent(
                "/load-docs-for-url",
                "POST",
                {
                    url: "https://docs.example.com"
                },
                {
                    Authorization: `Bearer ${invalidJwt}`
                }
            );
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(401);
            expect(JSON.parse(result.body).error).toBe("UnauthorizedError");
        });

        it("should return 404 when domain is not registered", async () => {
            // Mock empty DocsV2 result and empty V1 Docs result (fallback)
            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // Empty DocsV2 query
                .mockResolvedValueOnce({ rows: [] }); // Empty V1 Docs query

            const event = createMockEvent(
                "/load-docs-for-url",
                "POST",
                {
                    url: "https://unknown.example.com"
                },
                {
                    Authorization: "Bearer test-token"
                }
            );
            const context = createMockContext();

            const result = await handler(event, context);

            expect(result.statusCode).toBe(404);
            expect(JSON.parse(result.body)).toEqual({
                error: "DomainNotRegisteredError",
                message: "Domain not registered",
                requestId: "test-request-id"
            });
        });

        it("should handle docs with API definitions", async () => {
            const mockDocsDefinition = Buffer.from(
                JSON.stringify({
                    type: "v3",
                    pages: {},
                    config: {
                        navigation: { items: [] },
                        colorsV3: { type: "light" }
                    },
                    files: {},
                    referencedApis: ["api-1", "api-2"]
                })
            );

            const mockApiDefinition = Buffer.from(
                JSON.stringify({
                    rootPackage: {
                        endpoints: [],
                        types: [],
                        webhooks: [],
                        websockets: [],
                        subpackages: [],
                        pointsTo: null
                    },
                    subpackages: {},
                    navigation: null,
                    auth: null
                })
            );

            mockQuery
                // DocsV2 query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            orgID: "test-org",
                            domain: "docs.example.com",
                            path: "",
                            docsDefinition: mockDocsDefinition,
                            docsConfigInstanceId: "config-123",
                            authType: "PUBLIC",
                            hasPublicS3Assets: true
                        }
                    ]
                })
                // ApiDefinitionsV2 query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            apiDefinitionId: "api-1",
                            definition: mockApiDefinition
                        }
                    ]
                })
                // ApiDefinitionsLatest query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            apiDefinitionId: "api-2",
                            definition: mockApiDefinition
                        }
                    ]
                });

            // Use a valid service JWT instead of a plain token
            const validJwt = await signTestServiceJwt();
            const event = createMockEvent(
                "/load-docs-for-url",
                "POST",
                {
                    url: "https://docs.example.com"
                },
                {
                    Authorization: `Bearer ${validJwt}`
                }
            );
            const context = createMockContext();

            const result = await handler(event, context);

            // Log the error if test fails
            if (result.statusCode !== 200) {
                console.error("Error response:", JSON.parse(result.body));
            }

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.definition).toBeDefined();
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
