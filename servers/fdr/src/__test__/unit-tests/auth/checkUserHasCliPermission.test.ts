import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError, UnavailableError, UserDoesNotHaveCliPermissionError } from "../../../api/generated/api";
import { AuthServiceImpl, isAuth0Token } from "../../../services/auth/AuthService";

/**
 * Creates a mock JWT token with the specified issuer.
 * This is a simplified JWT structure for testing purposes.
 */
function createMockJwt(issuer: string): string {
    const header = { alg: "RS256", typ: "JWT" };
    const payload = { iss: issuer, sub: "auth0|user123", exp: Date.now() + 3600000 };
    const signature = "mock-signature";

    const base64UrlEncode = (obj: object): string => {
        const json = JSON.stringify(obj);
        const base64 = Buffer.from(json).toString("base64");
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };

    return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.${signature}`;
}

// Mock the user-permissions module
vi.mock("@fern-api/user-permissions", () => ({
    getManagementClientResult: vi.fn(),
    getRolesResult: vi.fn(),
    hasResourcePermission: vi.fn()
}));

// Mock the venus-api-sdk module
vi.mock("@fern-api/venus-api-sdk", () => ({
    FernVenusApi: {
        OrganizationId: (id: string) => id
    },
    FernVenusApiClient: vi.fn()
}));

import { getManagementClientResult, getRolesResult, hasResourcePermission } from "@fern-api/user-permissions";
import { FernVenusApiClient } from "@fern-api/venus-api-sdk";

const mockGetManagementClientResult = vi.mocked(getManagementClientResult);
const mockGetRolesResult = vi.mocked(getRolesResult);
const mockHasResourcePermission = vi.mocked(hasResourcePermission);
const MockFernVenusApiClient = vi.mocked(FernVenusApiClient);

describe("checkUserHasCliPermission", () => {
    let authService: AuthServiceImpl;
    let mockVenusClient: {
        user: { getMyself: ReturnType<typeof vi.fn> };
    };
    let mockLogger: {
        error: ReturnType<typeof vi.fn>;
        warn: ReturnType<typeof vi.fn>;
        debug: ReturnType<typeof vi.fn>;
    };
    let auth0Jwt: string;
    const originalAuth0Domain = process.env.AUTH0_DOMAIN;

    beforeEach(() => {
        vi.clearAllMocks();

        // Set AUTH0_DOMAIN for tests that need to check Auth0 tokens
        process.env.AUTH0_DOMAIN = "fern-prod.us.auth0.com";
        // Create a valid Auth0 JWT for testing
        auth0Jwt = createMockJwt("https://fern-prod.us.auth0.com/");

        mockLogger = {
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };

        mockVenusClient = {
            user: { getMyself: vi.fn() }
        };

        MockFernVenusApiClient.mockImplementation(() => mockVenusClient as any);

        const mockApp = {
            config: {
                venusUrl: "https://venus.test.com",
                // Allowlist of org IDs for CLI permission checks (controller uses this to gate checks)
                cliPermissionCheckOrgIds: new Set(["test-org", "fern-org", "allowed-org"])
            },
            logger: mockLogger
        } as any;

        authService = new AuthServiceImpl(mockApp);
    });

    afterEach(() => {
        // Restore original AUTH0_DOMAIN
        if (originalAuth0Domain !== undefined) {
            process.env.AUTH0_DOMAIN = originalAuth0Domain;
        } else {
            delete process.env.AUTH0_DOMAIN;
        }
    });

    it("should throw UnauthorizedError when auth header is missing", async () => {
        await expect(
            authService.checkUserHasCliPermission({
                authHeader: undefined,
                orgId: "test-org"
            })
        ).rejects.toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError when Venus returns error for getMyself", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: false,
            error: { message: "Invalid token" }
        });

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org"
            })
        ).rejects.toThrow(UnauthorizedError);

        expect(mockLogger.error).toHaveBeenCalledWith("Failed to get user from Venus", expect.anything());
    });

    it("should throw UnavailableError when Auth0 org lookup fails", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        mockGetManagementClientResult.mockReturnValue(err({ message: "Auth0 not configured" } as any));

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org"
            })
        ).rejects.toThrow(UnavailableError);

        expect(mockLogger.error).toHaveBeenCalledWith("Failed to resolve Auth0 org ID for test-org", expect.anything());
    });

    it("should throw UnavailableError when getRolesResult fails", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        const mockAuth0Client = {
            organizations: {
                getByName: vi.fn().mockResolvedValue({
                    data: { id: "org_abc123" }
                })
            }
        };
        mockGetManagementClientResult.mockReturnValue(ok(mockAuth0Client as any));

        mockGetRolesResult.mockResolvedValue(err({ message: "Failed to get roles" } as any));

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org"
            })
        ).rejects.toThrow(UnavailableError);

        expect(mockLogger.error).toHaveBeenCalledWith("Failed to get roles for user auth0|user123", expect.anything());
    });

    it("should succeed when user has cli role", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        const mockAuth0Client = {
            organizations: {
                getByName: vi.fn().mockResolvedValue({
                    data: { id: "org_abc123" }
                })
            }
        };
        mockGetManagementClientResult.mockReturnValue(ok(mockAuth0Client as any));

        mockGetRolesResult.mockResolvedValue(ok({ data: ["cli", "viewer"] }));

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org"
            })
        ).resolves.toBeUndefined();

        expect(mockLogger.debug).toHaveBeenCalledWith("User auth0|user123 has org-level CLI permission for test-org");
    });

    it("should succeed when user has admin role", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        const mockAuth0Client = {
            organizations: {
                getByName: vi.fn().mockResolvedValue({
                    data: { id: "org_abc123" }
                })
            }
        };
        mockGetManagementClientResult.mockReturnValue(ok(mockAuth0Client as any));

        mockGetRolesResult.mockResolvedValue(ok({ data: ["admin"] }));

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org"
            })
        ).resolves.toBeUndefined();

        expect(mockLogger.debug).toHaveBeenCalledWith("User auth0|user123 has org-level CLI permission for test-org");
    });

    it("should throw UserDoesNotHaveCliPermissionError when user lacks cli role and no docsUrl", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        const mockAuth0Client = {
            organizations: {
                getByName: vi.fn().mockResolvedValue({
                    data: { id: "org_abc123" }
                })
            }
        };
        mockGetManagementClientResult.mockReturnValue(ok(mockAuth0Client as any));

        mockGetRolesResult.mockResolvedValue(ok({ data: ["viewer"] }));

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org"
            })
        ).rejects.toThrow(UserDoesNotHaveCliPermissionError);

        expect(mockLogger.warn).toHaveBeenCalledWith(
            "User auth0|user123 does not have CLI permission for org test-org"
        );
    });

    it("should succeed when user has fine-grained cli permission for existing docs site", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        const mockAuth0Client = {
            organizations: {
                getByName: vi.fn().mockResolvedValue({
                    data: { id: "org_abc123" }
                })
            }
        };
        mockGetManagementClientResult.mockReturnValue(ok(mockAuth0Client as any));

        mockGetRolesResult.mockResolvedValue(
            ok({ data: ["viewer"] }) // No cli or admin role
        );

        mockHasResourcePermission.mockResolvedValue(true);

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org",
                docsUrl: "https://docs.example.com"
            })
        ).resolves.toBeUndefined();

        expect(mockHasResourcePermission).toHaveBeenCalledWith({
            sessionPermissions: [],
            userId: "auth0|user123",
            orgId: "org_abc123",
            permissionToCheck: "cli",
            resourceType: "docs",
            resourceId: "https://docs.example.com",
            forceFineGrained: true
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
            "User auth0|user123 has fine-grained CLI permission for docs https://docs.example.com"
        );
    });

    it("should throw UserDoesNotHaveCliPermissionError when user lacks both org-level and fine-grained permissions", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        const mockAuth0Client = {
            organizations: {
                getByName: vi.fn().mockResolvedValue({
                    data: { id: "org_abc123" }
                })
            }
        };
        mockGetManagementClientResult.mockReturnValue(ok(mockAuth0Client as any));

        mockGetRolesResult.mockResolvedValue(
            ok({ data: ["viewer"] }) // No cli or admin role
        );

        mockHasResourcePermission.mockResolvedValue(false);

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org",
                docsUrl: "https://docs.example.com"
            })
        ).rejects.toThrow(UserDoesNotHaveCliPermissionError);

        expect(mockLogger.warn).toHaveBeenCalledWith(
            "User auth0|user123 does not have CLI permission for org test-org or docs https://docs.example.com"
        );
    });

    it("should strip Bearer prefix from auth header (case insensitive)", async () => {
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        const mockAuth0Client = {
            organizations: {
                getByName: vi.fn().mockResolvedValue({
                    data: { id: "org_abc123" }
                })
            }
        };
        mockGetManagementClientResult.mockReturnValue(ok(mockAuth0Client as any));

        mockGetRolesResult.mockResolvedValue(ok({ data: ["cli"] }));

        // Test with lowercase "bearer" and Auth0 JWT
        await authService.checkUserHasCliPermission({
            authHeader: `bearer ${auth0Jwt}`,
            orgId: "test-org"
        });

        // Verify Venus client was constructed with the token (without Bearer prefix)
        expect(MockFernVenusApiClient).toHaveBeenCalledWith({
            environment: "https://venus.test.com",
            token: auth0Jwt
        });
    });

    it("should skip CLI permission check for non-Auth0 tokens (legacy org tokens)", async () => {
        // Legacy fern tokens are not JWTs, so they should skip the permission check
        const legacyFernToken = "fern_Ngp2jvASiBGMG-BAs9XBsy3sqLY8WruC";

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${legacyFernToken}`,
                orgId: "fern-org"
            })
        ).resolves.toBeUndefined();

        expect(mockLogger.debug).toHaveBeenCalledWith(
            "Skipping CLI permission check for non-Auth0 token for org fern-org"
        );

        expect(mockVenusClient.user.getMyself).not.toHaveBeenCalled();
        expect(mockGetManagementClientResult).not.toHaveBeenCalled();
        expect(mockGetRolesResult).not.toHaveBeenCalled();
    });

    it("should skip CLI permission check for JWTs from non-Auth0 issuers", async () => {
        // Create a JWT with a different issuer (AUTH0_DOMAIN is already set in beforeEach)
        const nonAuth0Jwt = createMockJwt("https://other-issuer.com/");

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${nonAuth0Jwt}`,
                orgId: "test-org"
            })
        ).resolves.toBeUndefined();

        expect(mockLogger.debug).toHaveBeenCalledWith(
            "Skipping CLI permission check for non-Auth0 token for org test-org"
        );

        expect(mockVenusClient.user.getMyself).not.toHaveBeenCalled();
    });

    it("should check permissions for Auth0 JWTs", async () => {
        // AUTH0_DOMAIN and auth0Jwt are already set in beforeEach
        mockVenusClient.user.getMyself.mockResolvedValue({
            ok: true,
            body: { userId: "auth0|user123" }
        });

        const mockAuth0Client = {
            organizations: {
                getByName: vi.fn().mockResolvedValue({
                    data: { id: "org_abc123" }
                })
            }
        };
        mockGetManagementClientResult.mockReturnValue(ok(mockAuth0Client as any));

        mockGetRolesResult.mockResolvedValue(ok({ data: ["cli"] }));

        await expect(
            authService.checkUserHasCliPermission({
                authHeader: `Bearer ${auth0Jwt}`,
                orgId: "test-org"
            })
        ).resolves.toBeUndefined();

        expect(mockVenusClient.user.getMyself).toHaveBeenCalled();
        expect(mockGetManagementClientResult).toHaveBeenCalled();
        expect(mockGetRolesResult).toHaveBeenCalled();
    });
});

describe("isAuth0Token", () => {
    const originalEnv = process.env.AUTH0_DOMAIN;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.AUTH0_DOMAIN = originalEnv;
        } else {
            delete process.env.AUTH0_DOMAIN;
        }
    });

    it("should return false when AUTH0_DOMAIN is not set", () => {
        delete process.env.AUTH0_DOMAIN;
        const token = createMockJwt("https://fern-prod.us.auth0.com/");
        expect(isAuth0Token(token)).toBe(false);
    });

    it("should return true for Auth0 JWT with matching issuer", () => {
        process.env.AUTH0_DOMAIN = "fern-prod.us.auth0.com";
        const token = createMockJwt("https://fern-prod.us.auth0.com/");
        expect(isAuth0Token(token)).toBe(true);
    });

    it("should return false for JWT with non-matching issuer", () => {
        process.env.AUTH0_DOMAIN = "fern-prod.us.auth0.com";
        const token = createMockJwt("https://other-domain.auth0.com/");
        expect(isAuth0Token(token)).toBe(false);
    });

    it("should return false for non-JWT tokens", () => {
        process.env.AUTH0_DOMAIN = "fern-prod.us.auth0.com";
        expect(isAuth0Token("fern_Ngp2jvASiBGMG-BAs9XBsy3sqLY8WruC")).toBe(false);
        expect(isAuth0Token("not-a-jwt")).toBe(false);
        expect(isAuth0Token("")).toBe(false);
    });

    it("should return false for malformed JWTs", () => {
        process.env.AUTH0_DOMAIN = "fern-prod.us.auth0.com";
        expect(isAuth0Token("part1.part2")).toBe(false); // Only 2 parts
        expect(isAuth0Token("part1.part2.part3.part4")).toBe(false); // 4 parts
        expect(isAuth0Token("invalid.!!!.token")).toBe(false); // Invalid base64
    });

    it("should handle issuer URL parsing correctly", () => {
        process.env.AUTH0_DOMAIN = "fern-prod.us.auth0.com";

        // Auth0 issuers typically have trailing slash
        const tokenWithSlash = createMockJwt("https://fern-prod.us.auth0.com/");
        expect(isAuth0Token(tokenWithSlash)).toBe(true);

        // Should also work without trailing slash (URL parsing extracts hostname)
        const tokenWithoutSlash = createMockJwt("https://fern-prod.us.auth0.com");
        expect(isAuth0Token(tokenWithoutSlash)).toBe(true);
    });
});
