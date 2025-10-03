import { describe, expect, it } from "vitest";

import type { PlaygroundState } from "@fern-api/docs-auth";

import { resolveEndpointEnvironmentState } from "./endpoints";

describe("resolveEndpointEnvironmentState", () => {
    const mockInitialState: PlaygroundState = {
        auth: {
            basic: {
                username: "initial-user",
                password: "initial-pass"
            }
        },
        headers: {
            "X-Initial-Header": "initial-value",
            "X-Common-Header": "initial-common"
        },
        path_parameters: {
            userId: "initial-user-id",
            orgId: "initial-org-id"
        },
        query_parameters: {
            version: "v1",
            format: "json"
        }
    };

    const mockEnvState = {
        prod: {
            auth: {
                bearer_token: "prod-token"
            },
            headers: {
                "X-Prod-Header": "prod-value",
                "X-Common-Header": "prod-common"
            },
            path_parameters: {
                userId: "" // demonstrate unsetting a value
            },
            query_parameters: {
                version: "v2",
                environment: "production"
            }
        },
        staging: {
            auth: {
                basic: {
                    username: "staging-user",
                    password: "staging-pass"
                }
            },
            headers: {
                "X-Staging-Header": "staging-value"
            }
        }
    };

    describe("when no currentEnvironment is provided", () => {
        it("should return initialState", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: undefined,
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result).toBe(mockInitialState);
        });

        it("should return undefined when initialState is also undefined", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: undefined,
                initialState: undefined,
                envState: mockEnvState
            });

            expect(result).toBeUndefined();
        });
    });

    describe("when no matching environment is found", () => {
        it("should return initialState when envState is undefined", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "unknown-env",
                initialState: mockInitialState,
                envState: undefined
            });

            expect(result).toBe(mockInitialState);
        });

        it("should return initialState when no envState keys match", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "completely-different-environment",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result).toBe(mockInitialState);
        });

        it("should return undefined when initialState is also undefined", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "unknown-env",
                initialState: undefined,
                envState: mockEnvState
            });

            expect(result).toBeUndefined();
        });
    });

    describe("when environment matches using partial string matching", () => {
        it("should match when environment contains the envState key", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod.example.com",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result).toEqual({
                auth: {
                    bearer_token: "prod-token"
                },
                headers: {
                    "X-Initial-Header": "initial-value",
                    "X-Common-Header": "prod-common",
                    "X-Prod-Header": "prod-value"
                },
                path_parameters: {
                    userId: "",
                    orgId: "initial-org-id"
                },
                query_parameters: {
                    version: "v2",
                    format: "json",
                    environment: "production"
                }
            });
        });

        it("should match when envState key contains the environment", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result).toEqual({
                auth: {
                    bearer_token: "prod-token"
                },
                headers: {
                    "X-Initial-Header": "initial-value",
                    "X-Common-Header": "prod-common",
                    "X-Prod-Header": "prod-value"
                },
                path_parameters: {
                    userId: "",
                    orgId: "initial-org-id"
                },
                query_parameters: {
                    version: "v2",
                    format: "json",
                    environment: "production"
                }
            });
        });

        it("should not match case-insensitive (function is case-sensitive)", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "PROD.example.com",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            // Should not match because "PROD" doesn't include "prod" (case-sensitive)
            expect(result).toBe(mockInitialState);
        });
    });

    describe("merging behavior", () => {
        it("should replace auth completely when envState has auth", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result?.auth).toEqual({
                bearer_token: "prod-token" // from envState (replaces entire auth object)
            });
        });

        it("should merge headers with envState taking precedence", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result?.headers).toEqual({
                "X-Initial-Header": "initial-value", // from initialState
                "X-Common-Header": "prod-common", // from envState (overrides)
                "X-Prod-Header": "prod-value" // from envState
            });
        });

        it("should merge path_parameters with envState taking precedence", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result?.path_parameters).toEqual({
                userId: "", // from envState
                orgId: "initial-org-id" // from initialState
            });
        });

        it("should merge query_parameters with envState taking precedence", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result?.query_parameters).toEqual({
                version: "v2", // from envState
                format: "json", // from initialState
                environment: "production" // from envState
            });
        });
    });

    describe("edge cases", () => {
        it("should handle empty envState object", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: {}
            });

            expect(result).toBe(mockInitialState);
        });

        it("should handle undefined values in envState", () => {
            const envStateWithUndefined = {
                prod: {
                    auth: undefined,
                    headers: undefined,
                    path_parameters: undefined,
                    query_parameters: undefined
                }
            };

            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: envStateWithUndefined
            });

            expect(result).toEqual({
                auth: mockInitialState.auth, // should fallback to initial
                headers: mockInitialState.headers, // should fallback to initial
                path_parameters: mockInitialState.path_parameters, // should fallback to initial
                query_parameters: mockInitialState.query_parameters // should fallback to initial
            });
        });

        it("should handle partial undefined values in envState", () => {
            const envStateWithPartialUndefined = {
                prod: {
                    auth: {
                        bearer_token: "prod-token"
                    },
                    headers: undefined,
                    path_parameters: {
                        userId: "prod-user-id"
                    },
                    query_parameters: undefined
                }
            };

            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: envStateWithPartialUndefined
            });

            expect(result).toEqual({
                auth: {
                    bearer_token: "prod-token"
                },
                headers: mockInitialState.headers, // should fallback to initial
                path_parameters: {
                    userId: "prod-user-id",
                    orgId: "initial-org-id"
                },
                query_parameters: mockInitialState.query_parameters // should fallback to initial
            });
        });

        it("should handle empty string environment", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result).toBe(mockInitialState);
        });

        it("should handle multiple matching environments (first match wins)", () => {
            const multiMatchEnvState = {
                prod: {
                    auth: {
                        bearer_token: "prod-token"
                    }
                },
                "prod.example": {
                    auth: {
                        bearer_token: "prod-example-token"
                    }
                }
            };

            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod.example.com",
                initialState: mockInitialState,
                envState: multiMatchEnvState
            });

            // Should match "prod" first since it comes first in the object
            expect(result?.auth?.bearer_token).toBe("prod-token");
        });

        it("should handle null values in envState", () => {
            const envStateWithNull = {
                prod: {
                    auth: undefined,
                    headers: undefined,
                    path_parameters: undefined,
                    query_parameters: undefined
                }
            };

            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: envStateWithNull
            });

            expect(result).toEqual({
                auth: mockInitialState.auth, // should fallback to initial
                headers: mockInitialState.headers, // should fallback to initial
                path_parameters: mockInitialState.path_parameters, // should fallback to initial
                query_parameters: mockInitialState.query_parameters // should fallback to initial
            });
        });

        it("should handle whitespace-only environment", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "   ",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result).toBe(mockInitialState);
        });

        it("should handle exact string match", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result?.auth?.bearer_token).toBe("prod-token");
        });

        it("should handle substring match at beginning", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "prod-api.example.com",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result?.auth?.bearer_token).toBe("prod-token");
        });

        it("should handle substring match at end", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "api.prod",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result?.auth?.bearer_token).toBe("prod-token");
        });

        it("should handle substring match in middle", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "api-prod-server.example.com",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result?.auth?.bearer_token).toBe("prod-token");
        });
    });

    describe("staging environment tests", () => {
        it("should correctly merge staging environment state", () => {
            const result = resolveEndpointEnvironmentState({
                currentEnvironment: "staging.example.com",
                initialState: mockInitialState,
                envState: mockEnvState
            });

            expect(result).toEqual({
                auth: {
                    basic: {
                        username: "staging-user", // from envState (replaces entire auth object)
                        password: "staging-pass" // from envState
                    }
                },
                headers: {
                    "X-Initial-Header": "initial-value", // from initialState
                    "X-Common-Header": "initial-common", // from initialState
                    "X-Staging-Header": "staging-value" // from envState
                },
                path_parameters: {
                    orgId: "initial-org-id", // from initialState
                    userId: "initial-user-id" // from initialState
                },
                query_parameters: {
                    version: "v1", // from initialState
                    format: "json" // from initialState
                }
            });
        });
    });
});
