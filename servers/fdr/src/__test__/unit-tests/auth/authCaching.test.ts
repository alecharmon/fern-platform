import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthServiceImpl } from "../../../services/auth/AuthService";

// Mock jose library
vi.mock("jose", async () => {
    const actual = await vi.importActual<typeof import("jose")>("jose");
    return {
        ...actual,
        jwtVerify: vi.fn()
    };
});

/**
 * Creates a mock JWT token with the specified permissions.
 */
function createMockJwtWithPermissions(permissions: string[]): string {
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: "https://fern-prod.us.auth0.com/",
        sub: "auth0|user123",
        exp: Date.now() + 3600000,
        permissions
    };
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
    hasResourcePermission: vi.fn(),
    isSuperUser: (permissions: string[]) => permissions.includes("super-user")
}));

// Mock the venus-api-sdk module
vi.mock("@fern-api/venus-api-sdk", () => ({
    FernVenusApi: {
        OrganizationId: (id: string) => id
    },
    FernVenusApiClient: vi.fn()
}));

import { FernVenusApiClient } from "@fern-api/venus-api-sdk";
import { jwtVerify } from "jose";

const MockFernVenusApiClient = vi.mocked(FernVenusApiClient);
const mockJwtVerify = vi.mocked(jwtVerify);

describe("AuthService Caching", () => {
    let authService: AuthServiceImpl;
    let mockVenusClient: {
        organization: {
            isMember: ReturnType<typeof vi.fn>;
            get: ReturnType<typeof vi.fn>;
        };
    };
    let mockLogger: {
        error: ReturnType<typeof vi.fn>;
        warn: ReturnType<typeof vi.fn>;
        debug: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Set up Auth0 environment variables
        process.env.AUTH0_DOMAIN = "fern-prod.us.auth0.com";
        process.env.AUTH0_CLIENT_SECRET = "test-secret";

        mockLogger = {
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };

        mockVenusClient = {
            organization: {
                isMember: vi.fn(),
                get: vi.fn()
            }
        };

        MockFernVenusApiClient.mockImplementation(() => mockVenusClient as any);

        const mockApp = {
            config: {
                venusUrl: "https://venus.test.com"
            },
            logger: mockLogger
        } as any;

        authService = new AuthServiceImpl(mockApp);
    });

    describe("checkUserBelongsToOrg caching", () => {
        it("should cache successful org membership check and not call Venus again", async () => {
            const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

            // Mock jwtVerify to return successful verification without super-user permission
            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["read:docs"]
                }
            } as any);

            mockVenusClient.organization.isMember.mockResolvedValue({
                ok: true,
                body: true
            });

            // First call - should hit Venus
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "test-org"
            });

            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(1);

            // Second call - should use cache
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "test-org"
            });

            // Venus should still only have been called once
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith("Cache HIT: User belongs to org test-org");
        });

        it("should cache failed org membership check and throw from cache", async () => {
            const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["read:docs"]
                }
            } as any);

            mockVenusClient.organization.isMember.mockResolvedValue({
                ok: true,
                body: false
            });

            // First call - should hit Venus and throw UserNotInOrgError
            await expect(
                authService.checkUserBelongsToOrg({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org"
                })
            ).rejects.toThrow(ORPCError);

            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(1);

            // Second call - should use cache and throw from cache
            await expect(
                authService.checkUserBelongsToOrg({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org"
                })
            ).rejects.toThrow(ORPCError);

            // Venus should still only have been called once
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith("Cache HIT: User does not belong to org test-org");
        });

        it("should NOT cache Venus errors and retry on subsequent calls", async () => {
            const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["read:docs"]
                }
            } as any);

            // First call - Venus returns error
            mockVenusClient.organization.isMember.mockResolvedValueOnce({
                ok: false,
                error: { message: "Service unavailable" }
            });

            await expect(
                authService.checkUserBelongsToOrg({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org"
                })
            ).rejects.toThrow(ORPCError);

            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(1);

            // Second call - Venus should be called again since errors are not cached
            mockVenusClient.organization.isMember.mockResolvedValueOnce({
                ok: true,
                body: true
            });

            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "test-org"
            });

            // Venus should have been called twice
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(2);
        });

        it("should use separate cache entries for different orgs", async () => {
            const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["read:docs"]
                }
            } as any);

            mockVenusClient.organization.isMember.mockResolvedValue({
                ok: true,
                body: true
            });

            // Call for org1
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "org1"
            });

            // Call for org2
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "org2"
            });

            // Venus should have been called twice (once for each org)
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(2);

            // Call for org1 again - should use cache
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "org1"
            });

            // Venus should still have been called only twice
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(2);
        });

        it("should use separate cache entries for different users", async () => {
            const user1Token = createMockJwtWithPermissions(["read:docs"]);
            const user2Token = createMockJwtWithPermissions(["write:docs"]);

            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["read:docs"]
                }
            } as any);

            mockVenusClient.organization.isMember.mockResolvedValue({
                ok: true,
                body: true
            });

            // Call for user1
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${user1Token}`,
                orgId: "test-org"
            });

            // Call for user2
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${user2Token}`,
                orgId: "test-org"
            });

            // Venus should have been called twice (once for each user)
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(2);

            // Call for user1 again - should use cache
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${user1Token}`,
                orgId: "test-org"
            });

            // Venus should still have been called only twice
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(2);
        });

        it("should cache super-user check", async () => {
            const superUserToken = createMockJwtWithPermissions(["super-user"]);

            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["super-user"]
                }
            } as any);

            // First call
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${superUserToken}`,
                orgId: "test-org"
            });

            // Second call - should use cached super-user check
            await authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${superUserToken}`,
                orgId: "different-org"
            });

            // Venus should never be called for super-users
            expect(mockVenusClient.organization.isMember).not.toHaveBeenCalled();
        });
    });

    describe("concurrent request handling (thundering herd)", () => {
        it("should deduplicate concurrent requests for the same user/org", async () => {
            const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["read:docs"]
                }
            } as any);

            // Create a slow Venus response
            let resolveVenus: () => void;
            const venusPromise = new Promise<void>((resolve) => {
                resolveVenus = resolve;
            });

            mockVenusClient.organization.isMember.mockImplementation(async () => {
                await venusPromise;
                return { ok: true, body: true };
            });

            // Start multiple concurrent requests
            const promises = [
                authService.checkUserBelongsToOrg({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org"
                }),
                authService.checkUserBelongsToOrg({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org"
                }),
                authService.checkUserBelongsToOrg({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org"
                })
            ];

            // Resolve the Venus call
            resolveVenus!();

            // Wait for all promises to complete
            await Promise.all(promises);

            // Venus should only have been called ONCE despite 3 concurrent requests
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(1);
        });
    });

    describe("checkOrgHasSnippetTemplateAccess caching", () => {
        it("should cache org feature access and not call Venus again", async () => {
            const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["read:docs"]
                }
            } as any);

            mockVenusClient.organization.isMember.mockResolvedValue({
                ok: true,
                body: true
            });

            mockVenusClient.organization.get.mockResolvedValue({
                ok: true,
                body: {
                    snippetsApiAccessEnabled: true,
                    snippetTemplatesAccessEnabled: true
                }
            });

            // First call - should hit Venus for both membership and org get
            await authService.checkOrgHasSnippetTemplateAccess({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "test-org",
                failHard: false
            });

            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(1);
            expect(mockVenusClient.organization.get).toHaveBeenCalledTimes(1);

            // Second call - should use cache for both
            await authService.checkOrgHasSnippetTemplateAccess({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "test-org",
                failHard: false
            });

            // Venus should still only have been called once for each method
            expect(mockVenusClient.organization.isMember).toHaveBeenCalledTimes(1);
            expect(mockVenusClient.organization.get).toHaveBeenCalledTimes(1);
        });

        it("should deduplicate concurrent org feature access requests", async () => {
            const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

            mockJwtVerify.mockResolvedValue({
                payload: {
                    permissions: ["read:docs"]
                }
            } as any);

            mockVenusClient.organization.isMember.mockResolvedValue({
                ok: true,
                body: true
            });

            // Create a slow Venus org.get response
            let resolveVenus: () => void;
            const venusPromise = new Promise<void>((resolve) => {
                resolveVenus = resolve;
            });

            mockVenusClient.organization.get.mockImplementation(async () => {
                await venusPromise;
                return {
                    ok: true,
                    body: {
                        snippetsApiAccessEnabled: true,
                        snippetTemplatesAccessEnabled: true
                    }
                };
            });

            // Start multiple concurrent requests
            const promises = [
                authService.checkOrgHasSnippetTemplateAccess({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org",
                    failHard: false
                }),
                authService.checkOrgHasSnippetTemplateAccess({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org",
                    failHard: false
                }),
                authService.checkOrgHasSnippetTemplateAccess({
                    authHeader: `Bearer ${regularUserToken}`,
                    orgId: "test-org",
                    failHard: false
                })
            ];

            // Resolve the Venus call
            resolveVenus!();

            // Wait for all promises to complete
            await Promise.all(promises);

            // Venus org.get should only have been called ONCE despite 3 concurrent requests
            expect(mockVenusClient.organization.get).toHaveBeenCalledTimes(1);
        });
    });
});
