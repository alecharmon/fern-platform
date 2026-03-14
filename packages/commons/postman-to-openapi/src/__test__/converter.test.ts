import { describe, expect, it } from "vitest";

import { convert } from "../converter.js";
import type { PostmanCollection } from "../postman-types.js";

describe("convert", () => {
    it("converts a minimal collection", () => {
        const collection: PostmanCollection = {
            info: {
                name: "My API",
                schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            item: []
        };

        const spec = convert(collection);
        expect(spec.openapi).toBe("3.1.0");
        expect(spec.info.title).toBe("My API");
        expect(spec.info.version).toBe("1.0.0");
        expect(spec.paths).toEqual({});
    });

    it("preserves collection description", () => {
        const collection: PostmanCollection = {
            info: {
                name: "My API",
                description: "A comprehensive API for user management",
                version: "2.0.0"
            },
            item: []
        };

        const spec = convert(collection);
        expect(spec.info.description).toBe("A comprehensive API for user management");
        expect(spec.info.version).toBe("2.0.0");
    });

    it("converts a full collection with folders, auth, and examples", () => {
        const collection: PostmanCollection = {
            info: {
                name: "User Management API",
                description: "API for managing users",
                version: "1.0.0"
            },
            auth: {
                type: "bearer",
                bearer: [{ key: "token", value: "{{token}}" }]
            },
            variable: [{ key: "baseUrl", value: "https://api.example.com" }],
            item: [
                {
                    name: "Users",
                    description: "User endpoints",
                    item: [
                        {
                            name: "List Users",
                            request: {
                                method: "GET",
                                url: {
                                    raw: "{{baseUrl}}/users?page=1&limit=10",
                                    host: ["{{baseUrl}}"],
                                    path: ["users"],
                                    query: [
                                        { key: "page", value: "1" },
                                        { key: "limit", value: "10" }
                                    ]
                                }
                            },
                            response: [
                                {
                                    name: "Success",
                                    code: 200,
                                    status: "OK",
                                    header: [{ key: "Content-Type", value: "application/json" }],
                                    body: JSON.stringify({
                                        users: [{ id: 1, name: "Alice" }],
                                        total: 100
                                    })
                                }
                            ]
                        },
                        {
                            name: "Create User",
                            request: {
                                method: "POST",
                                url: {
                                    raw: "{{baseUrl}}/users",
                                    host: ["{{baseUrl}}"],
                                    path: ["users"]
                                },
                                header: [{ key: "Content-Type", value: "application/json" }],
                                body: {
                                    mode: "raw",
                                    raw: JSON.stringify({ name: "Bob", email: "bob@example.com" }),
                                    options: { raw: { language: "json" } }
                                }
                            },
                            response: [
                                {
                                    name: "Created",
                                    code: 201,
                                    status: "Created",
                                    body: JSON.stringify({ id: 2, name: "Bob", email: "bob@example.com" })
                                },
                                {
                                    name: "Validation Error",
                                    code: 400,
                                    status: "Bad Request",
                                    body: JSON.stringify({ error: "Email already exists" })
                                }
                            ]
                        },
                        {
                            name: "Get User",
                            request: {
                                method: "GET",
                                url: {
                                    raw: "{{baseUrl}}/users/:userId",
                                    host: ["{{baseUrl}}"],
                                    path: ["users", ":userId"],
                                    variable: [{ key: "userId", value: "1", description: "The user ID" }]
                                }
                            },
                            response: [
                                {
                                    name: "Success",
                                    code: 200,
                                    status: "OK",
                                    body: JSON.stringify({ id: 1, name: "Alice", email: "alice@example.com" })
                                },
                                {
                                    name: "Not Found",
                                    code: 404,
                                    status: "Not Found",
                                    body: JSON.stringify({ error: "User not found" })
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "Health",
                    item: [
                        {
                            name: "Health Check",
                            request: {
                                method: "GET",
                                url: {
                                    raw: "{{baseUrl}}/health",
                                    host: ["{{baseUrl}}"],
                                    path: ["health"]
                                }
                            }
                        }
                    ]
                }
            ]
        };

        const spec = convert(collection);

        // Check basic info
        expect(spec.info.title).toBe("User Management API");
        expect(spec.info.version).toBe("1.0.0");

        // Check servers
        expect(spec.servers).toBeDefined();
        expect(spec.servers!.length).toBeGreaterThan(0);

        // Check auth
        expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
        expect(spec.security).toEqual([{ bearerAuth: [] }]);

        // Check tags
        expect(spec.tags).toBeDefined();
        expect(spec.tags!.map((t) => t.name)).toContain("Users");
        expect(spec.tags!.map((t) => t.name)).toContain("Health");

        // Check paths
        expect(spec.paths["/users"]).toBeDefined();
        expect(spec.paths["/users"]!.get).toBeDefined();
        expect(spec.paths["/users"]!.post).toBeDefined();
        expect(spec.paths["/users/{userId}"]).toBeDefined();
        expect(spec.paths["/health"]).toBeDefined();

        // Check GET /users
        const listUsers = spec.paths["/users"]!.get!;
        expect(listUsers.tags).toEqual(["Users"]);
        expect(listUsers.parameters!.find((p) => p.name === "page")).toBeDefined();
        expect(listUsers.responses["200"]).toBeDefined();

        // Check POST /users
        const createUser = spec.paths["/users"]!.post!;
        expect(createUser.requestBody).toBeDefined();
        expect(createUser.responses["201"]).toBeDefined();
        expect(createUser.responses["400"]).toBeDefined();

        // Check GET /users/{userId}
        const getUser = spec.paths["/users/{userId}"]!.get!;
        const pathParam = getUser.parameters!.find((p) => p.name === "userId");
        expect(pathParam).toBeDefined();
        expect(pathParam!.in).toBe("path");
        expect(pathParam!.required).toBe(true);
        expect(getUser.responses["200"]).toBeDefined();
        expect(getUser.responses["404"]).toBeDefined();
    });

    it("handles collection with no auth", () => {
        const collection: PostmanCollection = {
            info: { name: "Public API" },
            item: [
                {
                    name: "Get Status",
                    request: {
                        method: "GET",
                        url: {
                            raw: "https://api.example.com/status",
                            protocol: "https",
                            host: ["api", "example", "com"],
                            path: ["status"]
                        }
                    }
                }
            ]
        };

        const spec = convert(collection);
        expect(spec.security).toBeUndefined();
        expect(spec.components).toBeUndefined();
    });

    it("handles collection with API key auth", () => {
        const collection: PostmanCollection = {
            info: { name: "Protected API" },
            auth: {
                type: "apikey",
                apikey: [
                    { key: "key", value: "X-API-Key" },
                    { key: "in", value: "header" }
                ]
            },
            item: []
        };

        const spec = convert(collection);
        expect(spec.components?.securitySchemes?.apiKeyAuth).toBeDefined();
        expect(spec.components!.securitySchemes!.apiKeyAuth!.type).toBe("apiKey");
        expect(spec.security).toEqual([{ apiKeyAuth: [] }]);
    });

    it("handles deeply nested folder structure", () => {
        const collection: PostmanCollection = {
            info: { name: "Nested API" },
            item: [
                {
                    name: "v1",
                    item: [
                        {
                            name: "Admin",
                            item: [
                                {
                                    name: "Users",
                                    item: [
                                        {
                                            name: "List Admin Users",
                                            request: {
                                                method: "GET",
                                                url: {
                                                    raw: "https://api.example.com/v1/admin/users",
                                                    protocol: "https",
                                                    host: ["api", "example", "com"],
                                                    path: ["v1", "admin", "users"]
                                                }
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const spec = convert(collection);
        expect(spec.tags).toBeDefined();
        expect(spec.tags!.map((t) => t.name)).toContain("v1");
        expect(spec.tags!.map((t) => t.name)).toContain("Admin");
        expect(spec.tags!.map((t) => t.name)).toContain("Users");

        const getOp = spec.paths["/v1/admin/users"]!.get!;
        expect(getOp.tags).toEqual(["v1", "Admin", "Users"]);
    });

    it("converts a collection with multiple HTTP methods on same path", () => {
        const collection: PostmanCollection = {
            info: { name: "CRUD API" },
            item: [
                {
                    name: "Get Resource",
                    request: {
                        method: "GET",
                        url: {
                            raw: "https://api.example.com/resources/1",
                            protocol: "https",
                            host: ["api", "example", "com"],
                            path: ["resources", "1"]
                        }
                    }
                },
                {
                    name: "Update Resource",
                    request: {
                        method: "PUT",
                        url: {
                            raw: "https://api.example.com/resources/1",
                            protocol: "https",
                            host: ["api", "example", "com"],
                            path: ["resources", "1"]
                        },
                        body: { mode: "raw", raw: '{"name": "Updated"}', options: { raw: { language: "json" } } }
                    }
                },
                {
                    name: "Delete Resource",
                    request: {
                        method: "DELETE",
                        url: {
                            raw: "https://api.example.com/resources/1",
                            protocol: "https",
                            host: ["api", "example", "com"],
                            path: ["resources", "1"]
                        }
                    }
                }
            ]
        };

        const spec = convert(collection);
        const pathItem = spec.paths["/resources/1"]!;
        expect(pathItem.get).toBeDefined();
        expect(pathItem.put).toBeDefined();
        expect(pathItem.delete).toBeDefined();
    });

    it("converts a collection with graphql body", () => {
        const collection: PostmanCollection = {
            info: { name: "GraphQL API" },
            item: [
                {
                    name: "Query Users",
                    request: {
                        method: "POST",
                        url: {
                            raw: "https://api.example.com/graphql",
                            protocol: "https",
                            host: ["api", "example", "com"],
                            path: ["graphql"]
                        },
                        body: {
                            mode: "graphql",
                            graphql: {
                                query: "query { users { id name } }",
                                variables: '{"limit": 10}'
                            }
                        }
                    }
                }
            ]
        };

        const spec = convert(collection);
        const postOp = spec.paths["/graphql"]!.post!;
        expect(postOp.requestBody).toBeDefined();
        const bodyContent = postOp.requestBody!.content["application/json"];
        expect(bodyContent).toBeDefined();
        expect(bodyContent!.schema!.properties!.query).toEqual({ type: "string" });
        expect(bodyContent!.schema!.properties!.variables).toEqual({ type: "object" });
    });

    it("handles collection with OAuth2 auth", () => {
        const collection: PostmanCollection = {
            info: { name: "OAuth2 API" },
            auth: {
                type: "oauth2",
                oauth2: [
                    { key: "grant_type", value: "authorization_code" },
                    { key: "authUrl", value: "https://auth.example.com/authorize" },
                    { key: "accessTokenUrl", value: "https://auth.example.com/token" },
                    { key: "scope", value: "read write admin" }
                ]
            },
            item: []
        };

        const spec = convert(collection);
        const oauth2 = spec.components?.securitySchemes?.oauth2Auth;
        expect(oauth2).toBeDefined();
        expect(oauth2!.type).toBe("oauth2");
        expect(oauth2!.flows?.authorizationCode?.authorizationUrl).toBe("https://auth.example.com/authorize");
        expect(oauth2!.flows?.authorizationCode?.tokenUrl).toBe("https://auth.example.com/token");
        expect(oauth2!.flows?.authorizationCode?.scopes).toEqual({ read: "", write: "", admin: "" });
    });

    it("infers schemas from response body examples", () => {
        const collection: PostmanCollection = {
            info: { name: "Schema Inference API" },
            item: [
                {
                    name: "Get Complex Object",
                    request: {
                        method: "GET",
                        url: {
                            raw: "https://api.example.com/data",
                            protocol: "https",
                            host: ["api", "example", "com"],
                            path: ["data"]
                        }
                    },
                    response: [
                        {
                            name: "Success",
                            code: 200,
                            status: "OK",
                            body: JSON.stringify({
                                id: "550e8400-e29b-41d4-a716-446655440000",
                                name: "Test",
                                count: 42,
                                active: true,
                                created_at: "2024-01-15T10:30:00Z",
                                tags: ["alpha", "beta"],
                                metadata: { key: "value" }
                            })
                        }
                    ]
                }
            ]
        };

        const spec = convert(collection);
        const schema = spec.paths["/data"]!.get!.responses["200"]!.content!["application/json"]!.schema!;
        expect(schema.type).toBe("object");
        expect(schema.properties!.id!.format).toBe("uuid");
        expect(schema.properties!.count!.type).toBe("integer");
        expect(schema.properties!.active!.type).toBe("boolean");
        expect(schema.properties!.created_at!.format).toBe("date-time");
        expect(schema.properties!.tags!.type).toBe("array");
        expect(schema.properties!.metadata!.type).toBe("object");
    });

    it("handles file upload body mode", () => {
        const collection: PostmanCollection = {
            info: { name: "File API" },
            item: [
                {
                    name: "Upload Binary",
                    request: {
                        method: "POST",
                        url: {
                            raw: "https://api.example.com/upload",
                            protocol: "https",
                            host: ["api", "example", "com"],
                            path: ["upload"]
                        },
                        body: {
                            mode: "file",
                            file: { src: "file.bin" }
                        }
                    }
                }
            ]
        };

        const spec = convert(collection);
        const postOp = spec.paths["/upload"]!.post!;
        expect(postOp.requestBody!.content["application/octet-stream"]).toBeDefined();
        expect(postOp.requestBody!.content["application/octet-stream"]!.schema).toEqual({
            type: "string",
            format: "binary"
        });
    });

    it("handles collection with variables used in URLs", () => {
        const collection: PostmanCollection = {
            info: { name: "Variable API" },
            variable: [
                { key: "baseUrl", value: "https://api.example.com" },
                { key: "version", value: "v2" }
            ],
            item: [
                {
                    name: "Get Users",
                    request: {
                        method: "GET",
                        url: {
                            raw: "{{baseUrl}}/{{version}}/users",
                            host: ["{{baseUrl}}"],
                            path: ["{{version}}", "users"]
                        }
                    }
                }
            ]
        };

        const spec = convert(collection);
        expect(spec.servers).toBeDefined();
        expect(spec.paths["/v2/users"]).toBeDefined();
    });

    it("handles collection with request that has no URL", () => {
        const collection: PostmanCollection = {
            info: {
                _postman_id: "e6b7594e-0317-40d2-ac93-200b42473790",
                name: "test-mar-14",
                schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            item: [
                {
                    name: "test-url",
                    request: {
                        method: "GET",
                        header: [],
                        description: "blach"
                    },
                    response: []
                }
            ]
        };

        const spec = convert(collection);

        expect(spec.openapi).toBe("3.1.0");
        expect(spec.info.title).toBe("test-mar-14");

        // A single path should be created
        const pathKeys = Object.keys(spec.paths);
        expect(pathKeys).toHaveLength(1);

        const pathKey = pathKeys[0]!;
        const pathItem = spec.paths[pathKey]!;
        expect(pathItem.get).toBeDefined();
        expect(pathItem.get!.summary).toBe("test-url");
        expect(pathItem.get!.description).toBe("blach");
        expect(pathItem.get!.responses["200"]).toBeDefined();
    });
});
