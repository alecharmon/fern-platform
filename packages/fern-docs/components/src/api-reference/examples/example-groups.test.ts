import type { EndpointDefinition, ExampleEndpointCall } from "@fern-api/fdr-sdk/api-definition";
import { EndpointId } from "@fern-api/fdr-sdk/api-definition";
import { describe, expect, it } from "vitest";
import {
    compareByRequestData,
    deduplicateSegmentedControlExamples,
    getValidExampleKey,
    getVisibleExampleKeys,
    groupExamplesByLanguageKeyAndStatusCode,
    hasRequestSideData,
    isVisibleExampleKey,
    startsWithDefault
} from "./example-groups";

describe("example-groups", () => {
    describe("startsWithDefault", () => {
        it("returns true for names starting with 'Default'", () => {
            expect(startsWithDefault("Default")).toBe(true);
            expect(startsWithDefault("default")).toBe(true);
            expect(startsWithDefault("DEFAULT")).toBe(true);
            expect(startsWithDefault("  Default Example")).toBe(true);
        });

        it("returns false for names not starting with 'Default'", () => {
            expect(startsWithDefault("Example")).toBe(false);
            expect(startsWithDefault("PrimaryLocale")).toBe(false);
            expect(startsWithDefault(null)).toBe(false);
            expect(startsWithDefault(undefined)).toBe(false);
        });
    });

    describe("compareByRequestData", () => {
        it("prioritizes examples with request data", () => {
            expect(compareByRequestData(true, false, "A", "B")).toBe(-1);
            expect(compareByRequestData(false, true, "A", "B")).toBe(1);
        });

        it("preserves order when both have or don't have request data", () => {
            expect(compareByRequestData(true, true, "A", "B")).toBe(0);
            expect(compareByRequestData(false, false, "A", "B")).toBe(0);
        });

        it("preserves order for names starting with 'Default'", () => {
            expect(compareByRequestData(true, false, "A", "Default Example")).toBe(0);
            expect(compareByRequestData(false, true, "Default Example", "B")).toBe(0);
        });
    });

    describe("hasRequestSideData", () => {
        it("returns true for examples with request body", () => {
            const exampleCall = {
                path: "/test",
                responseStatusCode: 200,
                pathParameters: {},
                queryParameters: {},
                headers: {},
                requestBody: {
                    type: "json",
                    value: { key: "value" }
                }
            } as ExampleEndpointCall;
            expect(hasRequestSideData(exampleCall)).toBe(true);
        });

        it("returns true for examples with meaningful path parameters", () => {
            const exampleCall = {
                path: "/test/:id",
                responseStatusCode: 200,
                pathParameters: { id: "123" } as Record<string, unknown>,
                queryParameters: {},
                headers: {}
            } as ExampleEndpointCall;
            expect(hasRequestSideData(exampleCall)).toBe(true);
        });

        it("returns true for examples with meaningful query parameters", () => {
            const exampleCall = {
                path: "/test",
                responseStatusCode: 200,
                pathParameters: {},
                queryParameters: { filter: "active" } as Record<string, unknown>,
                headers: {}
            } as ExampleEndpointCall;
            expect(hasRequestSideData(exampleCall)).toBe(true);
        });

        it("returns false for examples with only placeholder path parameters", () => {
            const exampleCall = {
                path: "/test/:id",
                responseStatusCode: 200,
                pathParameters: { id: ":id" } as Record<string, unknown>,
                queryParameters: {},
                headers: {}
            } as ExampleEndpointCall;
            expect(hasRequestSideData(exampleCall)).toBe(false);
        });

        it("returns false for examples with no request data", () => {
            const exampleCall = {
                path: "/test",
                responseStatusCode: 200,
                pathParameters: {},
                queryParameters: {},
                headers: {}
            } as ExampleEndpointCall;
            expect(hasRequestSideData(exampleCall)).toBe(false);
        });
    });

    describe("groupExamplesByLanguageKeyAndStatusCode", () => {
        it("groups examples by language, key, and status code", () => {
            const endpoint: EndpointDefinition = {
                id: EndpointId("test-endpoint"),
                method: "POST",
                path: [],
                isResponseStream: false,
                errorsV2: [],
                examples: [
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "Example 1",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test" }
                        },
                        responseBody: {
                            type: "json",
                            value: { success: true }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST "https://api.example.com/test"',
                                    generated: true
                                }
                            ]
                        }
                    }
                ]
            } as unknown as EndpointDefinition;

            const result = groupExamplesByLanguageKeyAndStatusCode(endpoint);

            expect(result).toHaveProperty("curl");
            expect(result.curl).toBeDefined();
            expect(result.curl!["Example 1"]).toBeDefined();
            expect(result.curl!["Example 1"]![200]).toBeDefined();
            expect(result.curl!["Example 1"]![200]).toHaveLength(1);
            expect(result.curl!["Example 1"]![200]![0]!.code).toBe('curl -X POST "https://api.example.com/test"');
        });
    });

    describe("getValidExampleKey - prioritizes examples with request body data", () => {
        it("selects example with request body over example with only path parameters", () => {
            const endpoint: EndpointDefinition = {
                id: EndpointId("test-endpoint"),
                method: "POST",
                path: [],
                isResponseStream: false,
                errorsV2: [],
                examples: [
                    {
                        path: "/resources/:resource_id/items",
                        responseStatusCode: 200,
                        name: "Example A",
                        pathParameters: { resource_id: "abc123" },
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json"
                            // Note: no .value field - empty body
                        },
                        responseBody: {
                            type: "json",
                            value: { success: true }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: "curl -X POST https://api.example.com/resources/abc123/items",
                                    generated: true
                                }
                            ]
                        }
                    },
                    {
                        path: "/resources/:resource_id/items",
                        responseStatusCode: 200,
                        name: "Example B",
                        pathParameters: { resource_id: "abc123" },
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: {
                                items: ["item1", "item2"]
                            }
                        },
                        responseBody: {
                            type: "json",
                            value: { success: true }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST https://api.example.com/resources/abc123/items -d \'{"items":["item1","item2"]}\'',
                                    generated: true
                                }
                            ]
                        }
                    }
                ]
            } as unknown as EndpointDefinition;

            const examplesByLanguageKeyAndStatusCode = groupExamplesByLanguageKeyAndStatusCode(endpoint);
            const examplesByKeyAndStatusCode = examplesByLanguageKeyAndStatusCode.curl ?? {};

            // Get the first visible example key (should prioritize the one with body data)
            const selectedKey = getValidExampleKey(examplesByKeyAndStatusCode, undefined);

            expect(selectedKey).toBe("Example B");
        });

        it("returns current key if it exists and is valid", () => {
            const endpoint: EndpointDefinition = {
                id: EndpointId("test-endpoint"),
                method: "POST",
                path: [],
                isResponseStream: false,
                errorsV2: [],
                examples: [
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "Example 1",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test1" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST "https://api.example.com/test"',
                                    generated: true
                                }
                            ]
                        }
                    },
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "Example 2",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test2" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST "https://api.example.com/test"',
                                    generated: true
                                }
                            ]
                        }
                    }
                ]
            } as unknown as EndpointDefinition;

            const examplesByLanguageKeyAndStatusCode = groupExamplesByLanguageKeyAndStatusCode(endpoint);
            const examplesByKeyAndStatusCode = examplesByLanguageKeyAndStatusCode.curl ?? {};

            // If current key exists, it should be returned
            const selectedKey = getValidExampleKey(examplesByKeyAndStatusCode, "Example 2");

            expect(selectedKey).toBe("Example 2");
        });
    });

    describe("getVisibleExampleKeys", () => {
        it("returns all examples even when snippets are identical", () => {
            const endpoint: EndpointDefinition = {
                id: EndpointId("test-endpoint"),
                method: "POST",
                path: [],
                isResponseStream: false,
                errorsV2: [],
                examples: [
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "Example 1",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test1" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: "curl -X POST https://api.example.com/test",
                                    generated: true
                                }
                            ]
                        }
                    },
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "Example 2",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test2" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: "curl -X POST https://api.example.com/test",
                                    generated: true
                                }
                            ]
                        }
                    }
                ]
            } as unknown as EndpointDefinition;

            const examplesByLanguageKeyAndStatusCode = groupExamplesByLanguageKeyAndStatusCode(endpoint);
            const examplesByKeyAndStatusCode = examplesByLanguageKeyAndStatusCode.curl ?? {};

            const visibleKeys = getVisibleExampleKeys(examplesByKeyAndStatusCode);

            // Both examples should be visible even though code snippets are identical
            expect(visibleKeys).toEqual(["Example 1", "Example 2"]);
        });

        it("filters to user-defined examples when any exist", () => {
            const endpoint: EndpointDefinition = {
                id: EndpointId("test-endpoint"),
                method: "POST",
                path: [],
                isResponseStream: false,
                errorsV2: [],
                examples: [
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "Default",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test1" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST https://api.example.com/test -d \'{"data":"test1"}\'',
                                    generated: true
                                }
                            ]
                        }
                    },
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "auto_generated_example",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test2" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST https://api.example.com/test -d \'{"data":"test2"}\'',
                                    generated: true
                                }
                            ]
                        }
                    }
                ]
            } as unknown as EndpointDefinition;

            const examplesByLanguageKeyAndStatusCode = groupExamplesByLanguageKeyAndStatusCode(endpoint);
            const examplesByKeyAndStatusCode = examplesByLanguageKeyAndStatusCode.curl ?? {};

            const visibleKeys = getVisibleExampleKeys(examplesByKeyAndStatusCode);

            // Should only include the user-defined example "Default", not the auto-generated one
            expect(visibleKeys).toEqual(["Default"]);
        });

        it("returns keys in priority order matching getValidExampleKey selection", () => {
            const endpoint: EndpointDefinition = {
                id: EndpointId("test-endpoint"),
                method: "POST",
                path: [],
                isResponseStream: false,
                errorsV2: [],
                examples: [
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "Example A",
                        pathParameters: { id: "123" },
                        queryParameters: {},
                        headers: {},
                        // No request body, only path params
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: "curl -X POST https://api.example.com/test/123",
                                    generated: true
                                }
                            ]
                        }
                    },
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "Example B",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST https://api.example.com/test -d \'{"data":"test"}\'',
                                    generated: true
                                }
                            ]
                        }
                    }
                ]
            } as unknown as EndpointDefinition;

            const examplesByLanguageKeyAndStatusCode = groupExamplesByLanguageKeyAndStatusCode(endpoint);
            const examplesByKeyAndStatusCode = examplesByLanguageKeyAndStatusCode.curl ?? {};

            const visibleKeys = getVisibleExampleKeys(examplesByKeyAndStatusCode);
            const firstKey = getValidExampleKey(examplesByKeyAndStatusCode, undefined, visibleKeys);

            // The first visible key should match what getValidExampleKey selects
            expect(visibleKeys[0]).toBe(firstKey);
            // Example B should come first because it has request body data
            expect(visibleKeys[0]).toBe("Example B");
            expect(visibleKeys).toEqual(["Example B", "Example A"]);
        });

        it("returns all visible examples when no user-defined examples exist", () => {
            const endpoint: EndpointDefinition = {
                id: EndpointId("test-endpoint"),
                method: "POST",
                path: [],
                isResponseStream: false,
                errorsV2: [],
                examples: [
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "auto_example",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test1" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST https://api.example.com/test -d \'{"data":"test1"}\'',
                                    generated: true
                                }
                            ]
                        }
                    },
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        name: "another_auto_example",
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        requestBody: {
                            type: "json",
                            value: { data: "test2" }
                        },
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: 'curl -X POST https://api.example.com/test -d \'{"data":"test2"}\'',
                                    generated: true
                                }
                            ]
                        }
                    }
                ]
            } as unknown as EndpointDefinition;

            const examplesByLanguageKeyAndStatusCode = groupExamplesByLanguageKeyAndStatusCode(endpoint);
            const examplesByKeyAndStatusCode = examplesByLanguageKeyAndStatusCode.curl ?? {};

            const visibleKeys = getVisibleExampleKeys(examplesByKeyAndStatusCode);

            // Should include all examples since all are auto-generated
            expect(visibleKeys).toEqual(["auto_example", "another_auto_example"]);
        });

        it("returns empty array when no examples have request data and none are user-defined", () => {
            const endpoint: EndpointDefinition = {
                id: EndpointId("test-endpoint"),
                method: "GET",
                path: [],
                isResponseStream: false,
                errorsV2: [],
                examples: [
                    {
                        path: "/test",
                        responseStatusCode: 200,
                        pathParameters: {},
                        queryParameters: {},
                        headers: {},
                        snippets: {
                            curl: [
                                {
                                    language: "curl",
                                    code: "curl -X GET https://api.example.com/test",
                                    generated: true
                                }
                            ]
                        }
                    }
                ]
            } as unknown as EndpointDefinition;

            const examplesByLanguageKeyAndStatusCode = groupExamplesByLanguageKeyAndStatusCode(endpoint);
            const examplesByKeyAndStatusCode = examplesByLanguageKeyAndStatusCode.curl ?? {};

            const visibleKeys = getVisibleExampleKeys(examplesByKeyAndStatusCode);

            // Should return empty since example has no request data and is not user-defined
            expect(visibleKeys).toEqual([]);
        });
    });

    describe("isVisibleExampleKey", () => {
        it("returns true for examples with request body data", () => {
            const examplesByStatusCode = {
                "200": [
                    {
                        key: "curl-0,0",
                        exampleIndex: 0,
                        snippetIndex: 0,
                        exampleKey: "Test",
                        language: "curl",
                        name: "Test",
                        code: "curl test",
                        install: undefined,
                        exampleCall: {
                            path: "/test",
                            responseStatusCode: 200,
                            pathParameters: {},
                            queryParameters: {},
                            headers: {},
                            requestBody: {
                                type: "json",
                                value: { data: "test" }
                            }
                        } as ExampleEndpointCall
                    }
                ]
            };

            expect(isVisibleExampleKey(examplesByStatusCode)).toBe(true);
        });

        it("returns true for user-defined examples even without request data", () => {
            const examplesByStatusCode = {
                "200": [
                    {
                        key: "curl-0,0",
                        exampleIndex: 0,
                        snippetIndex: 0,
                        exampleKey: "UserDefinedExample",
                        language: "curl",
                        name: "UserDefinedExample",
                        code: "curl test",
                        install: undefined,
                        exampleCall: {
                            path: "/test",
                            responseStatusCode: 200,
                            name: "UserDefinedExample",
                            pathParameters: {},
                            queryParameters: {},
                            headers: {}
                        } as ExampleEndpointCall
                    }
                ]
            };

            expect(isVisibleExampleKey(examplesByStatusCode)).toBe(true);
        });

        it("returns false for examples without request data and not user-defined", () => {
            const examplesByStatusCode = {
                "200": [
                    {
                        key: "curl-0,0",
                        exampleIndex: 0,
                        snippetIndex: 0,
                        exampleKey: "Example 1",
                        language: "curl",
                        name: undefined,
                        code: "curl test",
                        install: undefined,
                        exampleCall: {
                            path: "/test",
                            responseStatusCode: 200,
                            pathParameters: {},
                            queryParameters: {},
                            headers: {}
                        } as ExampleEndpointCall
                    }
                ]
            };

            expect(isVisibleExampleKey(examplesByStatusCode)).toBe(false);
        });
    });

    describe("deduplicateSegmentedControlExamples", () => {
        it("preserves named examples with identical code (e.g. Image and Video)", () => {
            const examples = [
                {
                    exampleKey: "Image",
                    examples: [
                        {
                            key: "curl-0,0",
                            exampleIndex: 0,
                            snippetIndex: 0,
                            exampleKey: "Image",
                            language: "curl",
                            name: "Image",
                            code: "curl -G https://api.uploadcare.com/files/03ccf9ab-f2",
                            install: undefined,
                            exampleCall: {
                                path: "/files/:uuid/",
                                responseStatusCode: 200,
                                pathParameters: { uuid: "03ccf9ab-f2" },
                                queryParameters: {},
                                headers: {},
                                responseBody: { type: "json", value: { is_image: true, mime_type: "image/jpeg" } }
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                },
                {
                    exampleKey: "Video",
                    examples: [
                        {
                            key: "curl-1,0",
                            exampleIndex: 1,
                            snippetIndex: 0,
                            exampleKey: "Video",
                            language: "curl",
                            name: "Video",
                            code: "curl -G https://api.uploadcare.com/files/03ccf9ab-f2",
                            install: undefined,
                            exampleCall: {
                                path: "/files/:uuid/",
                                responseStatusCode: 200,
                                pathParameters: { uuid: "03ccf9ab-f2" },
                                queryParameters: {},
                                headers: {},
                                responseBody: { type: "json", value: { is_image: false, mime_type: "video/mp4" } }
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                }
            ];

            const result = deduplicateSegmentedControlExamples(examples);
            expect(result).toHaveLength(2);
            expect(result[0]!.exampleKey).toBe("Image");
            expect(result[1]!.exampleKey).toBe("Video");
        });

        it("preserves multiple status examples with identical code (e.g. Waiting, Progress, Success, Error, Unknown)", () => {
            const sharedCode = "curl -G https://upload.uploadcare.com/from_url/status/ -d token=abc";
            const examples = [
                {
                    exampleKey: "Waiting",
                    examples: [
                        {
                            key: "curl-0,0",
                            exampleIndex: 0,
                            snippetIndex: 0,
                            exampleKey: "Waiting",
                            language: "curl",
                            name: "Waiting",
                            code: sharedCode,
                            install: undefined,
                            exampleCall: {
                                path: "/from_url/status/",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {},
                                responseBody: { type: "json", value: { status: "waiting" } }
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                },
                {
                    exampleKey: "Progress",
                    examples: [
                        {
                            key: "curl-1,0",
                            exampleIndex: 1,
                            snippetIndex: 0,
                            exampleKey: "Progress",
                            language: "curl",
                            name: "Progress",
                            code: sharedCode,
                            install: undefined,
                            exampleCall: {
                                path: "/from_url/status/",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {},
                                responseBody: { type: "json", value: { status: "progress", done: 1024, total: 2048 } }
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                },
                {
                    exampleKey: "Success",
                    examples: [
                        {
                            key: "curl-2,0",
                            exampleIndex: 2,
                            snippetIndex: 0,
                            exampleKey: "Success",
                            language: "curl",
                            name: "Success",
                            code: sharedCode,
                            install: undefined,
                            exampleCall: {
                                path: "/from_url/status/",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {},
                                responseBody: { type: "json", value: { status: "success", uuid: "abc123" } }
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                },
                {
                    exampleKey: "Error",
                    examples: [
                        {
                            key: "curl-3,0",
                            exampleIndex: 3,
                            snippetIndex: 0,
                            exampleKey: "Error",
                            language: "curl",
                            name: "Error",
                            code: sharedCode,
                            install: undefined,
                            exampleCall: {
                                path: "/from_url/status/",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {},
                                responseBody: { type: "json", value: { status: "error", error: "download failed" } }
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                },
                {
                    exampleKey: "Unknown",
                    examples: [
                        {
                            key: "curl-4,0",
                            exampleIndex: 4,
                            snippetIndex: 0,
                            exampleKey: "Unknown",
                            language: "curl",
                            name: "Unknown",
                            code: sharedCode,
                            install: undefined,
                            exampleCall: {
                                path: "/from_url/status/",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {},
                                responseBody: { type: "json", value: { status: "unknown" } }
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                }
            ];

            const result = deduplicateSegmentedControlExamples(examples);
            expect(result).toHaveLength(5);
            expect(result.map((r) => r.exampleKey)).toEqual(["Waiting", "Progress", "Success", "Error", "Unknown"]);
        });

        it("removes true duplicates with same exampleKey and same code", () => {
            const examples = [
                {
                    exampleKey: "Example 1",
                    examples: [
                        {
                            key: "curl-0,0",
                            exampleIndex: 0,
                            snippetIndex: 0,
                            exampleKey: "Example 1",
                            language: "curl",
                            name: "Example 1",
                            code: "curl -X GET https://api.example.com/test",
                            install: undefined,
                            exampleCall: {
                                path: "/test",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {}
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                },
                {
                    exampleKey: "Example 1",
                    examples: [
                        {
                            key: "curl-0,1",
                            exampleIndex: 0,
                            snippetIndex: 1,
                            exampleKey: "Example 1",
                            language: "curl",
                            name: "Example 1",
                            code: "curl -X GET https://api.example.com/test",
                            install: undefined,
                            exampleCall: {
                                path: "/test",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {}
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                }
            ];

            const result = deduplicateSegmentedControlExamples(examples);
            expect(result).toHaveLength(1);
            expect(result[0]!.exampleKey).toBe("Example 1");
        });

        it("preserves examples with same exampleKey but different code", () => {
            const examples = [
                {
                    exampleKey: "Example 1",
                    examples: [
                        {
                            key: "curl-0,0",
                            exampleIndex: 0,
                            snippetIndex: 0,
                            exampleKey: "Example 1",
                            language: "curl",
                            name: "Example 1",
                            code: "curl -X GET https://api.example.com/v1/test",
                            install: undefined,
                            exampleCall: {
                                path: "/v1/test",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {}
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                },
                {
                    exampleKey: "Example 1",
                    examples: [
                        {
                            key: "curl-1,0",
                            exampleIndex: 1,
                            snippetIndex: 0,
                            exampleKey: "Example 1",
                            language: "curl",
                            name: "Example 1",
                            code: "curl -X GET https://api.example.com/v2/test",
                            install: undefined,
                            exampleCall: {
                                path: "/v2/test",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {}
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                }
            ];

            const result = deduplicateSegmentedControlExamples(examples);
            expect(result).toHaveLength(2);
        });

        it("keeps entry with empty examples array", () => {
            const examples = [
                { exampleKey: "Empty", examples: [] as any[] },
                {
                    exampleKey: "Normal",
                    examples: [
                        {
                            key: "curl-0,0",
                            exampleIndex: 0,
                            snippetIndex: 0,
                            exampleKey: "Normal",
                            language: "curl",
                            name: "Normal",
                            code: "curl test",
                            install: undefined,
                            exampleCall: {
                                path: "/test",
                                responseStatusCode: 200,
                                pathParameters: {},
                                queryParameters: {},
                                headers: {}
                            } as unknown as ExampleEndpointCall
                        }
                    ]
                }
            ];

            const result = deduplicateSegmentedControlExamples(examples);
            expect(result).toHaveLength(2);
        });

        it("returns empty array for empty input", () => {
            expect(deduplicateSegmentedControlExamples([])).toEqual([]);
        });
    });
});
