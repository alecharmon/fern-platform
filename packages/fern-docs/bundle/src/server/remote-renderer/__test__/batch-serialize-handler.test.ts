import { describe, expect, it } from "vitest";
import { EndpointNotInApiError } from "../errors";

// We can't import createLoaderShim directly since it's not exported,
// so we test the key generators and the shim behavior through the exported types.
// The loader shim logic is tested by reconstructing the same patterns used internally.

// ─── Key Generator Parity ───────────────────────────────
// These must match the key generators in pre-resolve-loader-data.ts

function endpointLocatorKey(method: string, path: string, example?: string, apiName?: string): string {
    return `${method}::${path}::${example ?? ""}::${apiName ?? ""}`;
}

function endpointDetailsKey(apiDefinitionId: string, endpointId: string): string {
    return `${apiDefinitionId}::${endpointId}`;
}

describe("loader shim key generators (parity with pre-resolve-loader-data)", () => {
    it("generates matching endpoint locator keys", () => {
        expect(endpointLocatorKey("POST", "/v2/payments", "ex1", "payments-api")).toBe(
            "POST::/v2/payments::ex1::payments-api"
        );
    });

    it("generates matching keys with missing optional fields", () => {
        expect(endpointLocatorKey("GET", "/users")).toBe("GET::/users::::");
    });

    it("generates matching endpoint details keys", () => {
        expect(endpointDetailsKey("api-def-123", "endpoint-456")).toBe("api-def-123::endpoint-456");
    });
});

// ─── Loader Shim Behavior ───────────────────────────────
// Test the loader shim's error handling logic by simulating its behavior

describe("loader shim endpoint resolution", () => {
    function createTestShim(preResolved: {
        resolvedEndpoints?: Array<[string, any]>;
        resolvedEndpointDetails?: Array<[string, any]>;
        resolvedWebhooks?: Array<[string, any]>;
        resolvedTypes?: Array<[string, any]>;
    }) {
        const resolvedEndpoints = new Map(preResolved.resolvedEndpoints ?? []);
        const resolvedEndpointDetails = new Map(preResolved.resolvedEndpointDetails ?? []);
        const resolvedWebhooks = new Map(preResolved.resolvedWebhooks ?? []);
        const resolvedTypes = new Map(preResolved.resolvedTypes ?? []);

        return {
            getEndpointByLocator: async (method: string, path: string, example?: string, apiName?: string) => {
                const key = endpointLocatorKey(method, path, example, apiName);
                if (!resolvedEndpoints.has(key)) {
                    throw new Error(
                        `Endpoint ${method} ${path}${apiName ? ` (api: ${apiName})` : ""}${example ? ` (example: ${example})` : ""} was not detected during MDX content scanning. ` +
                            `The endpoint prop may use a format the scanner doesn't recognize. ` +
                            `Available pre-resolved keys: [${[...resolvedEndpoints.keys()].join(", ")}]`
                    );
                }
                const result = resolvedEndpoints.get(key);
                if (result === null) {
                    throw new EndpointNotInApiError(method, path, apiName, example);
                }
                return result;
            },

            getEndpointById: async (apiDefinitionId: string, endpointId: string) => {
                const key = endpointDetailsKey(apiDefinitionId, endpointId);
                const result = resolvedEndpointDetails.get(key);
                if (!result) {
                    throw new Error(
                        `Endpoint details for ${apiDefinitionId}::${endpointId} not found in pre-resolved data. ` +
                            `The endpoint may not have been successfully resolved during pre-resolution on the bundle server.`
                    );
                }
                return result;
            },

            getWebhookByLocator: async (webhookId: string) => {
                return resolvedWebhooks.get(webhookId);
            },

            getTypes: async (apiName?: string) => {
                const key = apiName ?? "";
                const types = resolvedTypes.get(key);
                if (!types) {
                    return {};
                }
                return types;
            }
        };
    }

    describe("getEndpointByLocator", () => {
        it("returns endpoint data when found", async () => {
            const endpointData = { apiDefinitionId: "api-1", endpoint: { id: "ep-1" }, slugs: [] };
            const key = endpointLocatorKey("GET", "/users");
            const shim = createTestShim({
                resolvedEndpoints: [[key, endpointData]]
            });
            const result = await shim.getEndpointByLocator("GET", "/users");
            expect(result).toEqual(endpointData);
        });

        it("throws 'not detected' error when key is missing from map", async () => {
            const shim = createTestShim({ resolvedEndpoints: [] });
            await expect(shim.getEndpointByLocator("GET", "/users")).rejects.toThrow(
                "was not detected during MDX content scanning"
            );
        });

        it("throws 'does not exist' error when value is null (negative result)", async () => {
            const key = endpointLocatorKey("PUT", "/v1/prompts/{alias}/versions/{version}", undefined, "my-api");
            const shim = createTestShim({
                resolvedEndpoints: [[key, null]]
            });
            await expect(
                shim.getEndpointByLocator("PUT", "/v1/prompts/{alias}/versions/{version}", undefined, "my-api")
            ).rejects.toThrow("does not exist in the API definition");
        });

        it("throws EndpointNotInApiError (not plain Error) for null results", async () => {
            const key = endpointLocatorKey("GET", "/api/admin/metrics/feature-usage");
            const shim = createTestShim({
                resolvedEndpoints: [[key, null]]
            });
            await expect(shim.getEndpointByLocator("GET", "/api/admin/metrics/feature-usage")).rejects.toBeInstanceOf(
                EndpointNotInApiError
            );
        });

        it("throws plain Error (not EndpointNotInApiError) when key is missing from map", async () => {
            const shim = createTestShim({ resolvedEndpoints: [] });
            try {
                await shim.getEndpointByLocator("GET", "/users");
                expect.fail("should have thrown");
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
                expect(e).not.toBeInstanceOf(EndpointNotInApiError);
            }
        });

        it("includes api name in error message when provided", async () => {
            const shim = createTestShim({ resolvedEndpoints: [] });
            await expect(shim.getEndpointByLocator("GET", "/users", undefined, "users-api")).rejects.toThrow(
                "(api: users-api)"
            );
        });

        it("includes example in error message when provided", async () => {
            const shim = createTestShim({ resolvedEndpoints: [] });
            await expect(shim.getEndpointByLocator("GET", "/users", "get-user")).rejects.toThrow("(example: get-user)");
        });

        it("includes available keys in 'not detected' error", async () => {
            const key1 = endpointLocatorKey("POST", "/payments");
            const shim = createTestShim({
                resolvedEndpoints: [[key1, { apiDefinitionId: "a", endpoint: { id: "e" }, slugs: [] }]]
            });
            await expect(shim.getEndpointByLocator("GET", "/users")).rejects.toThrow(
                `Available pre-resolved keys: [${key1}]`
            );
        });
    });

    describe("getEndpointById", () => {
        it("returns endpoint details when found", async () => {
            const details = { endpoint: { id: "ep-1" }, globalHeaders: [], authSchemes: [], types: {} };
            const key = endpointDetailsKey("api-1", "ep-1");
            const shim = createTestShim({
                resolvedEndpointDetails: [[key, details]]
            });
            const result = await shim.getEndpointById("api-1", "ep-1");
            expect(result).toEqual(details);
        });

        it("throws when endpoint details not found", async () => {
            const shim = createTestShim({ resolvedEndpointDetails: [] });
            await expect(shim.getEndpointById("api-1", "ep-1")).rejects.toThrow("not found in pre-resolved data");
        });
    });

    describe("getWebhookByLocator", () => {
        it("returns webhook data when found", async () => {
            const webhookData = { apiDefinitionId: "api-1", webhook: { id: "wh-1" }, slug: undefined };
            const shim = createTestShim({
                resolvedWebhooks: [["payment.completed", webhookData]]
            });
            const result = await shim.getWebhookByLocator("payment.completed");
            expect(result).toEqual(webhookData);
        });

        it("returns undefined when webhook not found", async () => {
            const shim = createTestShim({ resolvedWebhooks: [] });
            const result = await shim.getWebhookByLocator("nonexistent");
            expect(result).toBeUndefined();
        });
    });

    describe("getTypes", () => {
        it("returns types when found for named api", async () => {
            const types = { "type-1": { name: "Invoice" } };
            const shim = createTestShim({
                resolvedTypes: [["accounting_v2", types]]
            });
            const result = await shim.getTypes("accounting_v2");
            expect(result).toEqual(types);
        });

        it("returns types for default (no apiName)", async () => {
            const types = { "type-1": { name: "User" } };
            const shim = createTestShim({
                resolvedTypes: [["", types]]
            });
            const result = await shim.getTypes();
            expect(result).toEqual(types);
        });

        it("returns empty object when types not found", async () => {
            const shim = createTestShim({ resolvedTypes: [] });
            const result = await shim.getTypes("nonexistent");
            expect(result).toEqual({});
        });

        it("returns empty object when default types not found", async () => {
            const shim = createTestShim({ resolvedTypes: [] });
            const result = await shim.getTypes();
            expect(result).toEqual({});
        });
    });
});
