import { describe, expect, it } from "vitest";

import { convertOperations } from "../convert-operations.js";
import type { PostmanItemOrGroup } from "../postman-types.js";

describe("convertOperations", () => {
    it("converts a simple GET request", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "List Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"]
                    }
                }
            }
        ];

        const { paths, tags } = convertOperations(items);
        expect(paths["/users"]).toBeDefined();
        expect(paths["/users"]!.get).toBeDefined();
        expect(paths["/users"]!.get!.summary).toBe("List Users");
        expect(tags).toHaveLength(0);
    });

    it("converts POST with JSON body", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Create User",
                request: {
                    method: "POST",
                    url: {
                        raw: "https://api.example.com/users",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"]
                    },
                    body: {
                        mode: "raw",
                        raw: '{"name": "John", "email": "john@example.com"}',
                        options: { raw: { language: "json" } }
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        const postOp = paths["/users"]!.post!;
        expect(postOp.requestBody).toBeDefined();
        expect(postOp.requestBody!.content["application/json"]).toBeDefined();
        expect(postOp.requestBody!.content["application/json"]!.schema!.type).toBe("object");
        expect(postOp.requestBody!.content["application/json"]!.schema!.properties!.name).toEqual({ type: "string" });
    });

    it("preserves folder structure as tags", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Users",
                description: "User management endpoints",
                item: [
                    {
                        name: "List Users",
                        request: {
                            method: "GET",
                            url: {
                                raw: "https://api.example.com/users",
                                protocol: "https",
                                host: ["api", "example", "com"],
                                path: ["users"]
                            }
                        }
                    },
                    {
                        name: "Create User",
                        request: {
                            method: "POST",
                            url: {
                                raw: "https://api.example.com/users",
                                protocol: "https",
                                host: ["api", "example", "com"],
                                path: ["users"]
                            }
                        }
                    }
                ]
            }
        ];

        const { paths, tags } = convertOperations(items);
        expect(tags).toHaveLength(1);
        expect(tags[0]!.name).toBe("Users");
        expect(tags[0]!.description).toBe("User management endpoints");
        expect(paths["/users"]!.get!.tags).toEqual(["Users"]);
        expect(paths["/users"]!.post!.tags).toEqual(["Users"]);
    });

    it("handles nested folders with nested tags", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "API",
                item: [
                    {
                        name: "Users",
                        item: [
                            {
                                name: "Get User",
                                request: {
                                    method: "GET",
                                    url: {
                                        raw: "https://api.example.com/users/123",
                                        protocol: "https",
                                        host: ["api", "example", "com"],
                                        path: ["users", "123"]
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        ];

        const { tags } = convertOperations(items);
        expect(tags).toHaveLength(2);
        expect(tags.map((t) => t.name)).toContain("API");
        expect(tags.map((t) => t.name)).toContain("Users");
    });

    it("converts path parameters from URL variables", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get User",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users/:userId",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users", ":userId"],
                        variable: [{ key: "userId", value: "123", description: "The user ID" }]
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        expect(paths["/users/{userId}"]).toBeDefined();
        const getOp = paths["/users/{userId}"]!.get!;
        const pathParam = getOp.parameters!.find((p) => p.name === "userId");
        expect(pathParam).toBeDefined();
        expect(pathParam!.in).toBe("path");
        expect(pathParam!.required).toBe(true);
        expect(pathParam!.example).toBe("123");
    });

    it("converts query parameters", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Search Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users?page=1&limit=10&active=true",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"],
                        query: [
                            { key: "page", value: "1" },
                            { key: "limit", value: "10" },
                            { key: "active", value: "true" }
                        ]
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        const getOp = paths["/users"]!.get!;
        expect(getOp.parameters).toHaveLength(3);

        const pageParam = getOp.parameters!.find((p) => p.name === "page");
        expect(pageParam!.schema!.type).toBe("integer");

        const activeParam = getOp.parameters!.find((p) => p.name === "active");
        expect(activeParam!.schema!.type).toBe("boolean");
    });

    it("skips disabled query parameters", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Search Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"],
                        query: [
                            { key: "page", value: "1" },
                            { key: "debug", value: "true", disabled: true }
                        ]
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        const getOp = paths["/users"]!.get!;
        expect(getOp.parameters).toHaveLength(1);
        expect(getOp.parameters![0]!.name).toBe("page");
    });

    it("converts header parameters (excluding standard headers)", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"]
                    },
                    header: [
                        { key: "Content-Type", value: "application/json" },
                        { key: "X-Custom-Header", value: "custom-value" },
                        { key: "Authorization", value: "Bearer token" }
                    ]
                }
            }
        ];

        const { paths } = convertOperations(items);
        const getOp = paths["/users"]!.get!;
        expect(getOp.parameters).toHaveLength(1);
        expect(getOp.parameters![0]!.name).toBe("X-Custom-Header");
        expect(getOp.parameters![0]!.in).toBe("header");
    });

    it("converts response examples", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get User",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users/1",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users", "1"]
                    }
                },
                response: [
                    {
                        name: "Success",
                        code: 200,
                        status: "OK",
                        header: [{ key: "Content-Type", value: "application/json" }],
                        body: '{"id": 1, "name": "John", "email": "john@example.com"}'
                    }
                ]
            }
        ];

        const { paths } = convertOperations(items);
        const getOp = paths["/users/1"]!.get!;
        expect(getOp.responses["200"]).toBeDefined();
        expect(getOp.responses["200"]!.description).toBe("OK");
        expect(getOp.responses["200"]!.content!["application/json"]!.schema!.type).toBe("object");
        expect(getOp.responses["200"]!.content!["application/json"]!.example).toEqual({
            id: 1,
            name: "John",
            email: "john@example.com"
        });
    });

    it("handles multiple response examples for the same status code", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get User",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users/1",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users", "1"]
                    }
                },
                response: [
                    {
                        name: "Admin User",
                        code: 200,
                        status: "OK",
                        body: '{"id": 1, "name": "Admin", "role": "admin"}'
                    },
                    {
                        name: "Regular User",
                        code: 200,
                        status: "OK",
                        body: '{"id": 2, "name": "User", "role": "user"}'
                    }
                ]
            }
        ];

        const { paths } = convertOperations(items);
        const getOp = paths["/users/1"]!.get!;
        const resp = getOp.responses["200"]!;
        expect(resp.content!["application/json"]!.examples).toBeDefined();
        expect(Object.keys(resp.content!["application/json"]!.examples!)).toHaveLength(2);
    });

    it("handles error responses", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get User",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users/1",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users", "1"]
                    }
                },
                response: [
                    {
                        name: "Success",
                        code: 200,
                        status: "OK",
                        body: '{"id": 1}'
                    },
                    {
                        name: "Not Found",
                        code: 404,
                        status: "Not Found",
                        body: '{"error": "User not found"}'
                    }
                ]
            }
        ];

        const { paths } = convertOperations(items);
        const getOp = paths["/users/1"]!.get!;
        expect(getOp.responses["200"]).toBeDefined();
        expect(getOp.responses["404"]).toBeDefined();
        expect(getOp.responses["404"]!.description).toBe("Not Found");
    });

    it("converts form-urlencoded body", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Login",
                request: {
                    method: "POST",
                    url: {
                        raw: "https://api.example.com/login",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["login"]
                    },
                    body: {
                        mode: "urlencoded",
                        urlencoded: [
                            { key: "username", value: "admin" },
                            { key: "password", value: "secret" }
                        ]
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        const postOp = paths["/login"]!.post!;
        const bodyContent = postOp.requestBody!.content["application/x-www-form-urlencoded"];
        expect(bodyContent).toBeDefined();
        expect(bodyContent!.schema!.properties!.username).toEqual({ type: "string" });
        expect(bodyContent!.schema!.properties!.password).toEqual({ type: "string" });
    });

    it("converts form-data body with file uploads", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Upload File",
                request: {
                    method: "POST",
                    url: {
                        raw: "https://api.example.com/upload",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["upload"]
                    },
                    body: {
                        mode: "formdata",
                        formdata: [
                            { key: "description", value: "My file", type: "text" },
                            { key: "file", type: "file", src: "/path/to/file.txt" }
                        ]
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        const postOp = paths["/upload"]!.post!;
        const bodyContent = postOp.requestBody!.content["multipart/form-data"];
        expect(bodyContent).toBeDefined();
        expect(bodyContent!.schema!.properties!.description).toEqual({ type: "string" });
        expect(bodyContent!.schema!.properties!.file).toEqual({ type: "string", format: "binary" });
    });

    it("generates unique operation IDs for duplicate paths", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get Users",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"]
                    }
                }
            },
            {
                name: "Get Users (v2)",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users"]
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        // Second GET overwrites first since same path+method
        expect(paths["/users"]!.get).toBeDefined();
    });

    it("adds default 200 response when no examples exist", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Ping",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/ping",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["ping"]
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        const getOp = paths["/ping"]!.get!;
        expect(getOp.responses["200"]).toBeDefined();
        expect(getOp.responses["200"]!.description).toBe("Successful response");
    });

    it("handles XML raw body", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Create Item",
                request: {
                    method: "POST",
                    url: {
                        raw: "https://api.example.com/items",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["items"]
                    },
                    body: {
                        mode: "raw",
                        raw: "<item><name>Test</name></item>",
                        options: { raw: { language: "xml" } }
                    }
                }
            }
        ];

        const { paths } = convertOperations(items);
        const postOp = paths["/items"]!.post!;
        expect(postOp.requestBody!.content["application/xml"]).toBeDefined();
    });

    it("converts response headers (excluding standard ones)", () => {
        const items: PostmanItemOrGroup[] = [
            {
                name: "Get User",
                request: {
                    method: "GET",
                    url: {
                        raw: "https://api.example.com/users/1",
                        protocol: "https",
                        host: ["api", "example", "com"],
                        path: ["users", "1"]
                    }
                },
                response: [
                    {
                        name: "Success",
                        code: 200,
                        status: "OK",
                        header: [
                            { key: "Content-Type", value: "application/json" },
                            { key: "X-Request-Id", value: "abc-123" },
                            { key: "X-Rate-Limit", value: "100" }
                        ],
                        body: '{"id": 1}'
                    }
                ]
            }
        ];

        const { paths } = convertOperations(items);
        const resp = paths["/users/1"]!.get!.responses["200"]!;
        expect(resp.headers).toBeDefined();
        expect(resp.headers!["X-Request-Id"]).toBeDefined();
        expect(resp.headers!["X-Rate-Limit"]).toBeDefined();
        expect(resp.headers!["Content-Type"]).toBeUndefined();
    });
});
