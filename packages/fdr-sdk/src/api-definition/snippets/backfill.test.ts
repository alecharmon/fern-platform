import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { type ApiDefinition, ApiDefinitionId, AuthSchemeId, EndpointId, EnvironmentId, PropertyKey } from "../latest";
import { backfillSnippets } from "./backfill";
import type { HttpSnippetLanguage } from "./types";

// Load actual fixtures at runtime
const fixturesDir = join(__dirname, "fixtures", "demo");
const typescriptFixture = JSON.parse(readFileSync(join(fixturesDir, "typescript.json"), "utf-8"));
const pythonFixture = JSON.parse(readFileSync(join(fixturesDir, "python.json"), "utf-8"));
const javaFixture = JSON.parse(readFileSync(join(fixturesDir, "java.json"), "utf-8"));
const goFixture = JSON.parse(readFileSync(join(fixturesDir, "go.json"), "utf-8"));
const rubyFixture = JSON.parse(readFileSync(join(fixturesDir, "ruby.json"), "utf-8"));
const phpFixture = JSON.parse(readFileSync(join(fixturesDir, "php.json"), "utf-8"));
const csharpFixture = JSON.parse(readFileSync(join(fixturesDir, "csharp.json"), "utf-8"));

// Load pinnacle fixtures
const pinnacleFixturesDir = join(__dirname, "fixtures", "pinnacle");
const pinnacleTypescriptFixture = JSON.parse(readFileSync(join(pinnacleFixturesDir, "typescript.json"), "utf-8"));
const pinnaclePythonFixture = JSON.parse(readFileSync(join(pinnacleFixturesDir, "python.json"), "utf-8"));
const pinnacleRubyFixture = JSON.parse(readFileSync(join(pinnacleFixturesDir, "ruby.json"), "utf-8"));

describe("backfillSnippets", () => {
    it("should backfill snippets only for specified languages when httpSnippets is an array", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("search")]: {
                    id: EndpointId("search"),
                    method: "POST",
                    path: [{ type: "literal", value: "/" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Basic Search",
                            description: "",
                            path: "/",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    query: "test"
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    results: []
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: ["curl", "python"] as HttpSnippetLanguage[],
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("search")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        const snippets = example?.snippets;
        expect(snippets).toBeDefined();

        expect(snippets?.curl).toBeDefined();
        expect(snippets?.curl).toHaveLength(1);
        expect(snippets?.python).toBeDefined();
        expect(snippets?.python).toHaveLength(1);

        expect(snippets?.javascript).toBeUndefined();
        expect(snippets?.go).toBeUndefined();
        expect(snippets?.ruby).toBeUndefined();
        expect(snippets?.java).toBeUndefined();
        expect(snippets?.php).toBeUndefined();
        expect(snippets?.csharp).toBeUndefined();
        expect(snippets?.swift).toBeUndefined();
    });

    it("should always include curl even when httpSnippets is false", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("search")]: {
                    id: EndpointId("search"),
                    method: "POST",
                    path: [{ type: "literal", value: "/" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Basic Search",
                            description: "",
                            path: "/",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    query: "test"
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    results: []
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: false,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("search")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        const snippets = example?.snippets;
        expect(snippets).toBeDefined();

        expect(snippets?.curl).toBeDefined();
        expect(snippets?.curl).toHaveLength(1);

        expect(snippets?.python).toBeUndefined();
        expect(snippets?.javascript).toBeUndefined();
        expect(snippets?.go).toBeUndefined();
        expect(snippets?.ruby).toBeUndefined();
        expect(snippets?.java).toBeUndefined();
        expect(snippets?.php).toBeUndefined();
        expect(snippets?.csharp).toBeUndefined();
        expect(snippets?.swift).toBeUndefined();
    });

    it("should not include curl when not specified in the language list", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("search")]: {
                    id: EndpointId("search"),
                    method: "POST",
                    path: [{ type: "literal", value: "/" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Basic Search",
                            description: "",
                            path: "/",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    query: "test"
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    results: []
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: ["python", "javascript", "go"] as HttpSnippetLanguage[],
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("search")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        const snippets = example?.snippets;
        expect(snippets).toBeDefined();

        expect(snippets?.curl).toBeUndefined();
        expect(snippets?.python).toBeDefined();
        expect(snippets?.python).toHaveLength(1);
        expect(snippets?.javascript).toBeDefined();
        expect(snippets?.javascript).toHaveLength(1);
        expect(snippets?.go).toBeDefined();
        expect(snippets?.go).toHaveLength(1);

        expect(snippets?.ruby).toBeUndefined();
        expect(snippets?.java).toBeUndefined();
        expect(snippets?.php).toBeUndefined();
        expect(snippets?.csharp).toBeUndefined();
        expect(snippets?.swift).toBeUndefined();
    });

    it("should backfill snippets for a search endpoint example", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("search")]: {
                    id: EndpointId("search"),
                    method: "POST",
                    path: [{ type: "literal", value: "/" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Basic Search",
                            description: "",
                            path: "/",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    RecordCount: 50,
                                    DocumentSearchParams: {
                                        SearchTerms: {
                                            All: ["data security"],
                                            Any: ["cyberattack", "breach"],
                                            None: ["ransomware"]
                                        },
                                        DocumentDateRangeStart: "2023-01-01T00:00:00Z",
                                        DocumentDateRangeEnd: "2023-12-31T23:59:59Z"
                                    }
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    TotalDocumentCount: 833494,
                                    NotReturnedDocumentCount: 0,
                                    ReturnedDocumentCount: 2,
                                    TruncatedDocumentCount: 0,
                                    Documents: [
                                        {
                                            IsTruncated: false,
                                            DocumentID: 77187402516,
                                            DocumentType: "NEWS",
                                            UploadDate: "2024-10-22T16:54:36Z",
                                            DocumentDate: "2024-10-22T15:17:54Z",
                                            DocumentName: "Wall Street Continues to See Recent Rally Cooling",
                                            DocumentText: "U.S. stocks dropped again on Tuesday...",
                                            AuthorName: "Natalie Venegas",
                                            DocumentSourceURL:
                                                "https://www.newsweek.com/wall-street-continues-see-recent-rally-cooling-1972948",
                                            DocumentImageURL:
                                                "https://d.newsweek.com/en/full/2501402/new-york-stock-exchange.jpg",
                                            LanguageID: "en",
                                            DocumentSentimentScore: "-13",
                                            ContainsViolence: true
                                        }
                                    ],
                                    FavIcons: {
                                        NEWS: "https://d1hgo075dbsz4i.cloudfront.net/21f4f43585ea45aa539034866e692e21/a/News/dsicon"
                                    }
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        // Verify the result has the expected structure
        const endpoint = result.endpoints[EndpointId("search")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        // Verify snippets were generated
        const snippets = example?.snippets;
        expect(snippets).toBeDefined();
        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        // Verify curl snippet contains expected content
        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("curl");
        expect(curlSnippet?.code).toContain("POST");
        expect(curlSnippet?.code).toContain('"RecordCount": 50');
        expect(curlSnippet?.code).toContain('"data security"');

        expect(example?.snippets).toMatchSnapshot();
    });

    it("should backfill dynamic snippets for typescript", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("createUser")]: {
                    id: EndpointId("createUser"),
                    method: "POST",
                    path: [{ type: "literal", value: "/users" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Create User",
                            description: "",
                            path: "/users",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    password: "securePassword123",
                                    role: "user"
                                }
                            },
                            responseStatusCode: 201,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: 1,
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    role: "user",
                                    status: "active",
                                    created_at: "2024-01-15T10:30:00Z",
                                    updated_at: "2024-01-15T10:30:00Z"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const dynamicIr = {
            typescript: typescriptFixture
        };

        const result = await backfillSnippets(apiDefinition, dynamicIr, flags);

        // Verify the result has the expected structure
        const endpoint = result.endpoints[EndpointId("createUser")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        // Verify snippets were generated
        const snippets = example?.snippets;
        expect(snippets).toBeDefined();
        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        // Verify curl snippet contains expected content
        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("curl");
        expect(curlSnippet?.code).toContain("POST");
        expect(curlSnippet?.code).toContain('"name": "John Doe"');
        expect(curlSnippet?.code).toContain('"email": "john.doe@example.com"');

        // Verify typescript snippet was generated
        const typescriptSnippets = snippets?.typescript;
        expect(typescriptSnippets).toBeDefined();
        expect(typescriptSnippets).toHaveLength(1);

        const typescriptSnippet = typescriptSnippets?.[0];
        expect(typescriptSnippet?.language).toBe("typescript");
        expect(typescriptSnippet?.code).toBeDefined();

        expect(example?.snippets).toMatchSnapshot();
    });

    it("should backfill dynamic snippets with multiple examples for typescript", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("createUser")]: {
                    id: EndpointId("createUser"),
                    method: "POST",
                    path: [{ type: "literal", value: "/users" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Create Regular User",
                            description: "",
                            path: "/users",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    password: "securePassword123",
                                    role: "user"
                                }
                            },
                            responseStatusCode: 201,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: 1,
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    role: "user",
                                    status: "active",
                                    created_at: "2024-01-15T10:30:00Z",
                                    updated_at: "2024-01-15T10:30:00Z"
                                }
                            },
                            snippets: undefined
                        },
                        {
                            name: "Create Admin User",
                            description: "",
                            path: "/users",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    name: "Jane Admin",
                                    email: "jane.admin@example.com",
                                    password: "adminPass456",
                                    role: "admin"
                                }
                            },
                            responseStatusCode: 201,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: 2,
                                    name: "Jane Admin",
                                    email: "jane.admin@example.com",
                                    role: "admin",
                                    status: "active",
                                    created_at: "2024-01-15T11:00:00Z",
                                    updated_at: "2024-01-15T11:00:00Z"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const dynamicIr = {
            typescript: typescriptFixture
        };

        const result = await backfillSnippets(apiDefinition, dynamicIr, flags);

        // Verify the result has the expected structure
        const endpoint = result.endpoints[EndpointId("createUser")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(2);

        const example = examples?.[0];
        expect(example).toBeDefined();

        // Verify snippets were generated for first example
        const snippets = example?.snippets;
        expect(snippets).toBeDefined();
        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        // Verify curl snippet contains expected content
        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("curl");
        expect(curlSnippet?.code).toContain("POST");
        expect(curlSnippet?.code).toContain('"name": "John Doe"');
        expect(curlSnippet?.code).toContain('"email": "john.doe@example.com"');

        // Check the second example
        const example2 = examples?.[1];
        expect(example2).toBeDefined();
        const snippets2 = example2?.snippets;
        expect(snippets2).toBeDefined();
        const curlSnippets2 = snippets2?.curl;
        expect(curlSnippets2).toBeDefined();
        expect(curlSnippets2).toHaveLength(1);
        const curlSnippet2 = curlSnippets2?.[0];
        expect(curlSnippet2?.code).toContain('"name": "Jane Admin"');
        expect(curlSnippet2?.code).toContain('"role": "admin"');

        // Check typescript snippets have two examples
        const typescriptSnippets = snippets?.typescript;
        expect(typescriptSnippets).toBeDefined();
        expect(typescriptSnippets).toHaveLength(1);

        const typescriptSnippets2 = snippets2?.typescript;
        expect(typescriptSnippets2).toBeDefined();
        expect(typescriptSnippets2).toHaveLength(1);

        // Check actual content of typescript snippets
        // example 1 should include evidence of the first example
        const typescriptSnippet1 = typescriptSnippets?.[0];
        expect(typescriptSnippet1?.code).toContain('name: "John Doe"');
        expect(typescriptSnippet1?.code).toContain('email: "john.doe@example.com"');
        expect(typescriptSnippet1?.code).toContain('role: "user"');

        // example 2 should include evidence of the second example
        const typescriptSnippet2 = typescriptSnippets2?.[0];
        expect(typescriptSnippet2?.code).toContain('name: "Jane Admin"');
        expect(typescriptSnippet2?.code).toContain('email: "jane.admin@example.com"');
        expect(typescriptSnippet2?.code).toContain('role: "admin"');

        expect(example?.snippets).toMatchSnapshot();
        expect(example2?.snippets).toMatchSnapshot();
    });

    it("should backfill dynamic snippets with multiple examples and error example for typescript", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("createUser")]: {
                    id: EndpointId("createUser"),
                    method: "POST",
                    path: [{ type: "literal", value: "/users" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Create Regular User",
                            description: "",
                            path: "/users",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    password: "securePassword123",
                                    role: "user"
                                }
                            },
                            responseStatusCode: 201,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: 1,
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    role: "user",
                                    status: "active",
                                    created_at: "2024-01-15T10:30:00Z",
                                    updated_at: "2024-01-15T10:30:00Z"
                                }
                            },
                            snippets: undefined
                        },
                        {
                            name: "Create Admin User",
                            description: "",
                            path: "/users",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    name: "Jane Admin",
                                    email: "jane.admin@example.com",
                                    password: "adminPass456",
                                    role: "admin"
                                }
                            },
                            responseStatusCode: 201,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: 2,
                                    name: "Jane Admin",
                                    email: "jane.admin@example.com",
                                    role: "admin",
                                    status: "active",
                                    created_at: "2024-01-15T11:00:00Z",
                                    updated_at: "2024-01-15T11:00:00Z"
                                }
                            },
                            snippets: undefined
                        },
                        {
                            name: "Create User - Unauthorized",
                            description: "",
                            path: "/users",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    name: "Bob User",
                                    email: "bob.user@example.com",
                                    password: "password789",
                                    role: "user"
                                }
                            },
                            responseStatusCode: 401,
                            responseBody: {
                                type: "json",
                                value: {
                                    error: "Unauthorized",
                                    code: "UNAUTHORIZED",
                                    details: {
                                        message: "Invalid authentication credentials"
                                    }
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const dynamicIr = {
            typescript: typescriptFixture
        };

        const result = await backfillSnippets(apiDefinition, dynamicIr, flags);

        // Verify the result has the expected structure
        const endpoint = result.endpoints[EndpointId("createUser")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(3);

        const example = examples?.[0];
        expect(example).toBeDefined();

        // Verify snippets were generated
        const snippets = example?.snippets;
        expect(snippets).toBeDefined();
        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        // Verify curl snippet contains expected content
        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("curl");
        expect(curlSnippet?.code).toContain("POST");
        expect(curlSnippet?.code).toContain('"name": "John Doe"');
        expect(curlSnippet?.code).toContain('"email": "john.doe@example.com"');

        // Check the error example (third example)
        const errorExample = examples?.[2];
        expect(errorExample).toBeDefined();
        expect(errorExample?.responseStatusCode).toBe(401);
        const errorSnippets = errorExample?.snippets;
        expect(errorSnippets).toBeDefined();
        const errorCurlSnippets = errorSnippets?.curl;
        expect(errorCurlSnippets).toBeDefined();
        expect(errorCurlSnippets).toHaveLength(1);

        // Check the typescript snippet includes all examples
        const typescriptSnippets = snippets?.typescript;
        expect(typescriptSnippets).toBeDefined();
        expect(typescriptSnippets).toHaveLength(1);

        const errorTypescriptSnippets = errorSnippets?.typescript;
        expect(errorTypescriptSnippets).toBeDefined();
        expect(errorTypescriptSnippets).toHaveLength(1);

        expect(example?.snippets).toMatchSnapshot();
    });

    it("should backfill dynamic snippets for typescript and python", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("createUser")]: {
                    id: EndpointId("createUser"),
                    method: "POST",
                    path: [{ type: "literal", value: "/users" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Create User",
                            description: "",
                            path: "/users",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    password: "securePassword123",
                                    role: "user"
                                }
                            },
                            responseStatusCode: 201,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: 1,
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    role: "user",
                                    status: "active",
                                    created_at: "2024-01-15T10:30:00Z",
                                    updated_at: "2024-01-15T10:30:00Z"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const dynamicIr = {
            typescript: typescriptFixture,
            python: pythonFixture
        };

        const result = await backfillSnippets(apiDefinition, dynamicIr, flags);

        // Verify the result has the expected structure
        const endpoint = result.endpoints[EndpointId("createUser")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        // Verify snippets were generated
        const snippets = example?.snippets;
        expect(snippets).toBeDefined();
        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        // Verify curl snippet contains expected content
        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("curl");
        expect(curlSnippet?.code).toContain("POST");
        expect(curlSnippet?.code).toContain('"name": "John Doe"');
        expect(curlSnippet?.code).toContain('"email": "john.doe@example.com"');

        // Check typescript and python snippets
        const typescriptSnippets = snippets?.typescript;
        expect(typescriptSnippets).toBeDefined();
        expect(typescriptSnippets).toHaveLength(1);
        expect(typescriptSnippets?.[0]?.language).toBe("typescript");

        const pythonSnippets = snippets?.python;
        expect(pythonSnippets).toBeDefined();
        expect(pythonSnippets).toHaveLength(1);
        expect(pythonSnippets?.[0]?.language).toBe("python");

        expect(example?.snippets).toMatchSnapshot();
    });

    it("should backfill dynamic snippets for all languages", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("createUser")]: {
                    id: EndpointId("createUser"),
                    method: "POST",
                    path: [{ type: "literal", value: "/users" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Create User",
                            description: "",
                            path: "/users",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    password: "securePassword123",
                                    role: "user"
                                }
                            },
                            responseStatusCode: 201,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: 1,
                                    name: "John Doe",
                                    email: "john.doe@example.com",
                                    role: "user",
                                    status: "active",
                                    created_at: "2024-01-15T10:30:00Z",
                                    updated_at: "2024-01-15T10:30:00Z"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const dynamicIr = {
            typescript: typescriptFixture,
            python: pythonFixture,
            java: javaFixture,
            go: goFixture,
            ruby: rubyFixture,
            php: phpFixture,
            csharp: csharpFixture
        };

        const result = await backfillSnippets(apiDefinition, dynamicIr, flags);

        // Verify the result has the expected structure
        const endpoint = result.endpoints[EndpointId("createUser")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        // Verify snippets were generated
        const snippets = example?.snippets;
        expect(snippets).toBeDefined();
        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        // Verify curl snippet contains expected content
        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("curl");
        expect(curlSnippet?.code).toContain("POST");
        expect(curlSnippet?.code).toContain('"name": "John Doe"');
        expect(curlSnippet?.code).toContain('"email": "john.doe@example.com"');

        // Check all snippets
        expect(snippets?.typescript).toBeDefined();
        expect(snippets?.typescript).toHaveLength(1);
        expect(snippets?.python).toBeDefined();
        expect(snippets?.python).toHaveLength(1);
        expect(snippets?.java).toBeDefined();
        expect(snippets?.java).toHaveLength(1);
        expect(snippets?.go).toBeDefined();
        expect(snippets?.go).toHaveLength(1);
        expect(snippets?.ruby).toBeDefined();
        expect(snippets?.ruby).toHaveLength(1);
        expect(snippets?.php).toBeDefined();
        expect(snippets?.php).toHaveLength(1);
        expect(snippets?.csharp).toBeDefined();
        expect(snippets?.csharp).toHaveLength(1);

        expect(example?.snippets).toMatchSnapshot();
    });

    it("should skip head method for dynamic snippets", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("checkUserExists")]: {
                    id: EndpointId("checkUserExists"),
                    method: "HEAD",
                    path: [
                        { type: "literal", value: "/users" },
                        { type: "literal", value: "/" },
                        { type: "pathParameter", value: PropertyKey("userId") }
                    ],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Check User Exists",
                            description: "",
                            path: "/users/123",
                            pathParameters: {
                                [PropertyKey("userId")]: 123
                            },
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: undefined,
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const dynamicIr = {
            typescript: typescriptFixture,
            python: pythonFixture,
            java: javaFixture,
            go: goFixture,
            ruby: rubyFixture,
            php: phpFixture,
            csharp: csharpFixture
        };

        const result = await backfillSnippets(apiDefinition, dynamicIr, flags);

        // Verify the result has the expected structure
        const endpoint = result.endpoints[EndpointId("checkUserExists")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        // Verify snippets were generated
        const snippets = example?.snippets;
        expect(snippets).toBeDefined();
        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        // Verify curl snippet contains expected content for HEAD method
        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("curl");
        expect(curlSnippet?.code).toContain("HEAD");

        // Check that dynamic snippets were skipped for HEAD method
        // HTTP snippets should still be generated for HEAD method
        expect(snippets?.typescript).toBeUndefined();
        expect(snippets?.python).toBeDefined();
        expect(snippets?.python).toHaveLength(1);
        expect(snippets?.java).toBeDefined();
        expect(snippets?.java).toHaveLength(1);
        expect(snippets?.go).toBeDefined();
        expect(snippets?.go).toHaveLength(1);
        expect(snippets?.ruby).toBeDefined();
        expect(snippets?.ruby).toHaveLength(1);
        expect(snippets?.php).toBeDefined();
        expect(snippets?.php).toHaveLength(1);
        expect(snippets?.csharp).toBeDefined();
        expect(snippets?.csharp).toHaveLength(1);

        expect(example?.snippets).toMatchSnapshot();
    });

    it("should backfill dynamic snippets for all pinnacle endpoints and languages", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("pinnacle-api"),
            apiName: undefined,
            endpoints: {
                // Contacts endpoints
                [EndpointId("createContact")]: {
                    id: EndpointId("createContact"),
                    method: "POST",
                    path: [{ type: "literal", value: "/contacts" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.pinnacle.us/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Create Contact",
                            description: "",
                            path: "/contacts",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    phoneNumber: "+15551234567",
                                    description: "Customer contact"
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: "contact_123",
                                    phoneNumber: "+15551234567",
                                    description: "Customer contact"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                },
                [EndpointId("getContact")]: {
                    id: EndpointId("getContact"),
                    method: "GET",
                    path: [{ type: "literal", value: "/contacts" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.pinnacle.us/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Contact",
                            description: "",
                            path: "/contacts",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: "contact_123",
                                    phoneNumber: "+15551234567",
                                    description: "Customer contact"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                },
                // Messages endpoints
                [EndpointId("sendSms")]: {
                    id: EndpointId("sendSms"),
                    method: "POST",
                    path: [{ type: "literal", value: "/messages/send/sms" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.pinnacle.us/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Send SMS",
                            description: "",
                            path: "/messages/send/sms",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    to: "+15551234567",
                                    from: "+15559876543",
                                    text: "Hello from Pinnacle!"
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    messageId: "msg_123",
                                    status: "sent"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                },
                [EndpointId("sendMms")]: {
                    id: EndpointId("sendMms"),
                    method: "POST",
                    path: [{ type: "literal", value: "/messages/send/mms" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.pinnacle.us/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Send MMS",
                            description: "",
                            path: "/messages/send/mms",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    to: "+15551234567",
                                    from: "+15559876543",
                                    text: "Check out this image!",
                                    mediaUrls: ["https://example.com/image.jpg"]
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    messageId: "msg_456",
                                    status: "sent"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                },
                // Phone Numbers endpoints
                [EndpointId("buyPhoneNumber")]: {
                    id: EndpointId("buyPhoneNumber"),
                    method: "POST",
                    path: [{ type: "literal", value: "/phone-numbers/buy" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.pinnacle.us/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Buy Phone Number",
                            description: "",
                            path: "/phone-numbers/buy",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    areaCode: "415",
                                    type: "local"
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    phoneNumber: "+14155551234",
                                    status: "active"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                },
                [EndpointId("searchPhoneNumbers")]: {
                    id: EndpointId("searchPhoneNumbers"),
                    method: "POST",
                    path: [{ type: "literal", value: "/phone-numbers/search" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.pinnacle.us/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Search Phone Numbers",
                            description: "",
                            path: "/phone-numbers/search",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    areaCode: "415",
                                    limit: 10
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    phoneNumbers: ["+14155551234", "+14155555678"]
                                }
                            },
                            snippets: undefined
                        }
                    ]
                },
                // Brands endpoints
                [EndpointId("getBrand")]: {
                    id: EndpointId("getBrand"),
                    method: "GET",
                    path: [
                        { type: "literal", value: "/brands" },
                        { type: "literal", value: "/" },
                        { type: "pathParameter", value: PropertyKey("id") }
                    ],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.pinnacle.us/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Brand",
                            description: "",
                            path: "/brands/brand_123",
                            pathParameters: {
                                [PropertyKey("id")]: "brand_123"
                            },
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: "brand_123",
                                    name: "Acme Corp",
                                    status: "approved"
                                }
                            },
                            snippets: undefined
                        }
                    ]
                },
                // Conversations endpoints
                [EndpointId("getConversation")]: {
                    id: EndpointId("getConversation"),
                    method: "POST",
                    path: [{ type: "literal", value: "/conversations/get" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: undefined,
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.pinnacle.us/v1"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Conversation",
                            description: "",
                            path: "/conversations/get",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: {
                                    conversationId: "conv_123"
                                }
                            },
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: {
                                    id: "conv_123",
                                    messages: [],
                                    participants: ["+15551234567"]
                                }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {},
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const dynamicIr = {
            typescript: pinnacleTypescriptFixture,
            python: pinnaclePythonFixture,
            ruby: pinnacleRubyFixture
        };

        const result = await backfillSnippets(apiDefinition, dynamicIr, flags);

        // Verify all endpoints have snippets generated
        expect(result.endpoints[EndpointId("createContact")]?.examples?.[0]?.snippets).toBeDefined();
        expect(result.endpoints[EndpointId("getContact")]?.examples?.[0]?.snippets).toBeDefined();
        expect(result.endpoints[EndpointId("sendSms")]?.examples?.[0]?.snippets).toBeDefined();
        expect(result.endpoints[EndpointId("sendMms")]?.examples?.[0]?.snippets).toBeDefined();
        expect(result.endpoints[EndpointId("buyPhoneNumber")]?.examples?.[0]?.snippets).toBeDefined();
        expect(result.endpoints[EndpointId("searchPhoneNumbers")]?.examples?.[0]?.snippets).toBeDefined();
        expect(result.endpoints[EndpointId("getBrand")]?.examples?.[0]?.snippets).toBeDefined();
        expect(result.endpoints[EndpointId("getConversation")]?.examples?.[0]?.snippets).toBeDefined();

        // Verify all languages are present for each endpoint
        const contactSnippets = result.endpoints[EndpointId("createContact")]?.examples?.[0]?.snippets;
        expect(contactSnippets?.typescript).toBeDefined();
        expect(contactSnippets?.python).toBeDefined();
        expect(contactSnippets?.ruby).toBeDefined();
        expect(contactSnippets?.curl).toBeDefined();

        // Snapshot the entire result to capture all endpoints with all languages
        expect(result).toMatchSnapshot();
    });

    it("should use multiAuth to select the correct auth scheme for curl snippets", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("merchantEndpoint")]: {
                    id: EndpointId("merchantEndpoint"),
                    method: "GET",
                    path: [{ type: "literal", value: "/merchant/withdraws" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: [AuthSchemeId("wallet"), AuthSchemeId("merchant")],
                    multiAuth: [
                        {
                            schemes: [AuthSchemeId("merchant")]
                        }
                    ],
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Withdraws",
                            description: "",
                            path: "/merchant/withdraws",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: { status: "completed" }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {
                [AuthSchemeId("wallet")]: {
                    type: "header",
                    headerWireValue: "x-custom-api-key",
                    nameOverride: undefined,
                    prefix: undefined,
                    description: undefined
                },
                [AuthSchemeId("merchant")]: {
                    type: "bearerAuth",
                    tokenName: undefined,
                    description: undefined
                }
            },
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("merchantEndpoint")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        const snippets = example?.snippets;
        expect(snippets).toBeDefined();

        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("Authorization:");
        expect(curlSnippet?.code).not.toContain("x-custom-api-key");
    });

    it("should regenerate curl snippet when existing snippet has wrong auth header", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("merchantEndpoint")]: {
                    id: EndpointId("merchantEndpoint"),
                    method: "GET",
                    path: [{ type: "literal", value: "/merchant/withdraws" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: [AuthSchemeId("wallet"), AuthSchemeId("merchant")],
                    multiAuth: [
                        {
                            schemes: [AuthSchemeId("merchant")]
                        }
                    ],
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Withdraws",
                            description: "",
                            path: "/merchant/withdraws",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: { status: "completed" }
                            },
                            snippets: {
                                curl: [
                                    {
                                        name: undefined,
                                        language: "curl",
                                        install: undefined,
                                        code: 'curl https://api.example.com/merchant/withdraws \\\n  -H "x-custom-api-key: <apiKey>"',
                                        generated: true,
                                        description: undefined
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            auths: {
                [AuthSchemeId("wallet")]: {
                    type: "header",
                    headerWireValue: "x-custom-api-key",
                    nameOverride: undefined,
                    prefix: undefined,
                    description: undefined
                },
                [AuthSchemeId("merchant")]: {
                    type: "bearerAuth",
                    tokenName: undefined,
                    description: undefined
                }
            },
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("merchantEndpoint")];
        expect(endpoint).toBeDefined();
        const examples = endpoint?.examples;
        expect(examples).toHaveLength(1);

        const example = examples?.[0];
        expect(example).toBeDefined();

        const snippets = example?.snippets;
        expect(snippets).toBeDefined();

        const curlSnippets = snippets?.curl;
        expect(curlSnippets).toBeDefined();
        expect(curlSnippets).toHaveLength(1);

        const curlSnippet = curlSnippets?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("Authorization:");
        expect(curlSnippet?.code).not.toContain("x-custom-api-key");
    });

    it("should not regenerate curl snippet when existing snippet has correct auth header", async () => {
        const existingCurlCode =
            'curl https://api.example.com/merchant/withdraws \\\n  -H "Authorization: Bearer <token>"';
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("merchantEndpoint")]: {
                    id: EndpointId("merchantEndpoint"),
                    method: "GET",
                    path: [{ type: "literal", value: "/merchant/withdraws" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: [AuthSchemeId("wallet"), AuthSchemeId("merchant")],
                    multiAuth: [
                        {
                            schemes: [AuthSchemeId("merchant")]
                        }
                    ],
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Withdraws",
                            description: "",
                            path: "/merchant/withdraws",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: { status: "completed" }
                            },
                            snippets: {
                                curl: [
                                    {
                                        name: undefined,
                                        language: "curl",
                                        install: undefined,
                                        code: existingCurlCode,
                                        generated: true,
                                        description: undefined
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            auths: {
                [AuthSchemeId("wallet")]: {
                    type: "header",
                    headerWireValue: "x-custom-api-key",
                    nameOverride: undefined,
                    prefix: undefined,
                    description: undefined
                },
                [AuthSchemeId("merchant")]: {
                    type: "bearerAuth",
                    tokenName: undefined,
                    description: undefined
                }
            },
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("merchantEndpoint")];
        const curlSnippet = endpoint?.examples?.[0]?.snippets?.curl?.[0];
        expect(curlSnippet?.code).toBe(existingCurlCode);
    });

    it("should fall back to endpoint.auth when multiAuth is not defined", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("walletEndpoint")]: {
                    id: EndpointId("walletEndpoint"),
                    method: "GET",
                    path: [{ type: "literal", value: "/wallet/balance" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: [AuthSchemeId("wallet")],
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Balance",
                            description: "",
                            path: "/wallet/balance",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: { balance: 100 }
                            },
                            snippets: undefined
                        }
                    ]
                }
            },
            auths: {
                [AuthSchemeId("wallet")]: {
                    type: "header",
                    headerWireValue: "x-custom-api-key",
                    nameOverride: undefined,
                    prefix: undefined,
                    description: undefined
                },
                [AuthSchemeId("merchant")]: {
                    type: "bearerAuth",
                    tokenName: undefined,
                    description: undefined
                }
            },
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("walletEndpoint")];
        expect(endpoint).toBeDefined();

        const curlSnippet = endpoint?.examples?.[0]?.snippets?.curl?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("x-custom-api-key:");
        expect(curlSnippet?.code).not.toContain("Authorization:");
    });

    it("should regenerate curl snippet when basic auth uses -H Authorization header instead of -u flag", async () => {
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("secureEndpoint")]: {
                    id: EndpointId("secureEndpoint"),
                    method: "GET",
                    path: [{ type: "literal", value: "/secure" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: [AuthSchemeId("basicAuth")],
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Secure",
                            description: "",
                            path: "/secure",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: { status: "ok" }
                            },
                            snippets: {
                                curl: [
                                    {
                                        name: undefined,
                                        language: "curl",
                                        install: undefined,
                                        code: 'curl https://api.example.com/secure \\\n  -H "Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ="',
                                        generated: true,
                                        description: undefined
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            auths: {
                [AuthSchemeId("basicAuth")]: {
                    type: "basicAuth",
                    usernameName: undefined,
                    passwordName: undefined,
                    passwordAlwaysEmpty: undefined,
                    description: undefined
                }
            },
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("secureEndpoint")];
        expect(endpoint).toBeDefined();

        const curlSnippet = endpoint?.examples?.[0]?.snippets?.curl?.[0];
        expect(curlSnippet?.language).toBe("curl");
        expect(curlSnippet?.code).toContain("-u ");
        expect(curlSnippet?.code).not.toContain('-H "Authorization: Basic');
    });

    it("should not regenerate curl snippet when basic auth already uses -u flag", async () => {
        const existingCurlCode = 'curl https://api.example.com/secure \\\n     -u "<username>:<password>"';
        const apiDefinition: ApiDefinition = {
            id: ApiDefinitionId("test-api"),
            apiName: undefined,
            endpoints: {
                [EndpointId("secureEndpoint")]: {
                    id: EndpointId("secureEndpoint"),
                    method: "GET",
                    path: [{ type: "literal", value: "/secure" }],
                    displayName: undefined,
                    operationId: undefined,
                    auth: [AuthSchemeId("basicAuth")],
                    multiAuth: undefined,
                    defaultEnvironment: undefined,
                    environments: [
                        {
                            id: EnvironmentId("default"),
                            baseUrl: "https://api.example.com"
                        }
                    ],
                    pathParameters: undefined,
                    queryParameters: undefined,
                    requestHeaders: undefined,
                    responseHeaders: undefined,
                    requests: undefined,
                    responses: undefined,
                    errors: undefined,
                    snippetTemplates: undefined,
                    protocol: undefined,
                    description: undefined,
                    availability: undefined,
                    namespace: undefined,
                    includeInApiExplorer: undefined,
                    examples: [
                        {
                            name: "Get Secure",
                            description: "",
                            path: "/secure",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: undefined,
                            responseStatusCode: 200,
                            responseBody: {
                                type: "json",
                                value: { status: "ok" }
                            },
                            snippets: {
                                curl: [
                                    {
                                        name: undefined,
                                        language: "curl",
                                        install: undefined,
                                        code: existingCurlCode,
                                        generated: true,
                                        description: undefined
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            auths: {
                [AuthSchemeId("basicAuth")]: {
                    type: "basicAuth",
                    usernameName: undefined,
                    passwordName: undefined,
                    passwordAlwaysEmpty: undefined,
                    description: undefined
                }
            },
            websockets: {},
            webhooks: {},
            graphqlOperations: {},
            types: {},
            globalHeaders: [],
            subpackages: {},
            snippetsConfiguration: undefined
        };

        const flags = {
            httpSnippets: true,
            alwaysEnableJavaScriptFetch: true
        };

        const result = await backfillSnippets(apiDefinition, undefined, flags);

        const endpoint = result.endpoints[EndpointId("secureEndpoint")];
        const curlSnippet = endpoint?.examples?.[0]?.snippets?.curl?.[0];
        expect(curlSnippet?.code).toBe(existingCurlCode);
    });
});
