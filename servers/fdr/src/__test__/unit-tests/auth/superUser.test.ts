import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError, UnavailableError, UserNotInOrgError } from "../../../api/generated/api";
import { AuthServiceImpl, isSuperUser } from "../../../services/auth/AuthService";

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
 * This is a simplified JWT structure for testing purposes.
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

/**
 * Creates a mock JWT token without permissions claim.
 */
function createMockJwtWithoutPermissions(): string {
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: "https://fern-prod.us.auth0.com/",
        sub: "auth0|user123",
        exp: Date.now() + 3600000
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
    // Provide real implementation for isSuperUser
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

describe("isSuperUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Set up environment variables for Auth0
        process.env.AUTH0_DOMAIN = "fern-prod.us.auth0.com";
        process.env.AUTH0_CLIENT_SECRET = "test-secret";
    });

    it("should return true when token contains super-user permission", async () => {
        const token = createMockJwtWithPermissions(["super-user"]);
        // Mock jwtVerify to return successful verification with permissions
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["super-user"]
            }
        } as any);
        expect(await isSuperUser(token)).toBe(true);
    });

    it("should return true when super-user is among multiple permissions", async () => {
        const token = createMockJwtWithPermissions(["read:docs", "super-user", "write:docs"]);
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["read:docs", "super-user", "write:docs"]
            }
        } as any);
        expect(await isSuperUser(token)).toBe(true);
    });

    it("should return false when token does not contain super-user permission", async () => {
        const token = createMockJwtWithPermissions(["read:docs", "write:docs"]);
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["read:docs", "write:docs"]
            }
        } as any);
        expect(await isSuperUser(token)).toBe(false);
    });

    it("should return false when permissions array is empty", async () => {
        const token = createMockJwtWithPermissions([]);
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: []
            }
        } as any);
        expect(await isSuperUser(token)).toBe(false);
    });

    it("should return false when token has no permissions claim", async () => {
        const token = createMockJwtWithoutPermissions();
        mockJwtVerify.mockResolvedValueOnce({
            payload: {}
        } as any);
        expect(await isSuperUser(token)).toBe(false);
    });

    it("should return false for non-JWT tokens", async () => {
        // jwtVerify will reject for invalid tokens
        mockJwtVerify.mockRejectedValue(new Error("Invalid JWT"));
        expect(await isSuperUser("fern_Ngp2jvASiBGMG-BAs9XBsy3sqLY8WruC")).toBe(false);
        expect(await isSuperUser("not-a-jwt")).toBe(false);
        expect(await isSuperUser("")).toBe(false);
    });

    it("should return false for malformed JWTs", async () => {
        mockJwtVerify.mockRejectedValue(new Error("Invalid JWT"));
        expect(await isSuperUser("part1.part2")).toBe(false);
        expect(await isSuperUser("part1.part2.part3.part4")).toBe(false);
        expect(await isSuperUser("invalid.!!!.token")).toBe(false);
    });

    it("should be case-sensitive for permission name", async () => {
        const tokenUpperCase = createMockJwtWithPermissions(["SUPER-USER"]);
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["SUPER-USER"]
            }
        } as any);
        expect(await isSuperUser(tokenUpperCase)).toBe(false);

        const tokenMixedCase = createMockJwtWithPermissions(["Super-User"]);
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["Super-User"]
            }
        } as any);
        expect(await isSuperUser(tokenMixedCase)).toBe(false);
    });

    it("should return false when AUTH0_DOMAIN is not configured", async () => {
        delete process.env.AUTH0_DOMAIN;
        const token = createMockJwtWithPermissions(["super-user"]);
        expect(await isSuperUser(token)).toBe(false);
        // jwtVerify should not be called if Auth0 is not configured
        expect(mockJwtVerify).not.toHaveBeenCalled();
    });

    it("should return false when signature verification fails", async () => {
        const token = createMockJwtWithPermissions(["super-user"]);
        // Mock jwtVerify to throw error (signature verification failed)
        mockJwtVerify.mockRejectedValueOnce(new Error("Signature verification failed"));
        expect(await isSuperUser(token)).toBe(false);
    });

    it("should return false when token is expired", async () => {
        const token = createMockJwtWithPermissions(["super-user"]);
        // Mock jwtVerify to throw error (token expired)
        mockJwtVerify.mockRejectedValueOnce(new Error("Token expired"));
        expect(await isSuperUser(token)).toBe(false);
    });

    it("should return false when issuer does not match", async () => {
        const token = createMockJwtWithPermissions(["super-user"]);
        // Mock jwtVerify to throw error (invalid issuer)
        mockJwtVerify.mockRejectedValueOnce(new Error("Invalid issuer"));
        expect(await isSuperUser(token)).toBe(false);
    });

    it("should handle real RS256 token with super-user permission", async () => {
        // Real RS256 token from Auth0 with super-user permission
        const realToken =
            "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjRkbVZ0U1E3eHFOUnhYd0c1SWlMUSJ9.eyJpc3MiOiJodHRwczovL2Zlcm4tcHJvZC51cy5hdXRoMC5jb20vIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMDg3NTgyMzMzNDcxOTY3MjQzODYiLCJhdWQiOlsidmVudXMtcHJvZCIsImh0dHBzOi8vZmVybi1wcm9kLnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3NjkwMjY0NzAsImV4cCI6MTc3MTYxODQ3MCwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCIsImF6cCI6InN5YVduazZTak5vbzV4QmYxb21mdnppVTNxNzA4NWxoIiwicGVybWlzc2lvbnMiOlsiY2xpIiwiZWRpdCIsIm1hbmFnZS1zZXR0aW5ncyIsIm1hbmFnZS11c2VycyIsInN1cGVyLXVzZXIiLCJ2aWV3Il19.ds6rMrVrrdofvFib_QdMLY3mLZKNCcjFJyPf5etLx4ovUoilWRfnsRRdY34eADHrVGJHfFBdatNGLHI8QYySYDXDM5Mn6q14P9H5vGGKOmzou0PLWZ03ckUYinRmrnEQYDnjKO4G_fj-fXEv0P1dsjNYevFMjsGsGvPA6bleBuGnbMkpr1Tg39eoWqlX25TuerNdMt5kaao3dXWjSb1Oo5JB5trKpce1xfdJ9_QHj8kWes2VUDzKGAjvrfjcAHPLGA3dZ13DgG4RiKsVKKzE5XOw-nWFjGYnoxMIRZDVh4XNPiY3XRbDmLR3aaaQiOMB98Cx06QRakp1xuGxjuXs-A";

        // Mock jwtVerify to return the actual token payload
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                iss: "https://fern-prod.us.auth0.com/",
                sub: "google-oauth2|108758233347196724386",
                permissions: ["cli", "edit", "manage-settings", "manage-users", "super-user", "view"]
            }
        } as any);

        expect(await isSuperUser(realToken)).toBe(true);
    });
});

describe("checkUserBelongsToOrg with super-user", () => {
    let authService: AuthServiceImpl;
    let mockVenusClient: {
        organization: { isMember: ReturnType<typeof vi.fn> };
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
            organization: { isMember: vi.fn() }
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

    it("should throw UnauthorizedError when auth header is missing", async () => {
        await expect(
            authService.checkUserBelongsToOrg({
                authHeader: undefined,
                orgId: "test-org"
            })
        ).rejects.toThrow(UnauthorizedError);
    });

    it("should bypass Venus check and succeed for super-user", async () => {
        const superUserToken = createMockJwtWithPermissions(["super-user"]);

        // Mock jwtVerify to return successful verification with super-user permission
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["super-user"]
            }
        } as any);

        await expect(
            authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${superUserToken}`,
                orgId: "test-org"
            })
        ).resolves.toBeUndefined();

        expect(mockLogger.debug).toHaveBeenCalledWith(
            "User has super-user permission, granting access to org test-org"
        );

        // Venus should NOT be called for super-users
        expect(mockVenusClient.organization.isMember).not.toHaveBeenCalled();
    });

    it("should bypass Venus check for super-user even for non-existent orgs", async () => {
        const superUserToken = createMockJwtWithPermissions(["super-user", "other-permission"]);

        // Mock jwtVerify to return successful verification with super-user permission
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["super-user", "other-permission"]
            }
        } as any);

        await expect(
            authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${superUserToken}`,
                orgId: "non-existent-org"
            })
        ).resolves.toBeUndefined();

        expect(mockVenusClient.organization.isMember).not.toHaveBeenCalled();
    });

    it("should check Venus membership for non-super-users", async () => {
        const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

        // Mock jwtVerify to return successful verification without super-user permission
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["read:docs"]
            }
        } as any);

        mockVenusClient.organization.isMember.mockResolvedValue({
            ok: true,
            body: true
        });

        await expect(
            authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "test-org"
            })
        ).resolves.toBeUndefined();

        // Venus SHOULD be called for regular users
        expect(mockVenusClient.organization.isMember).toHaveBeenCalledWith("test-org");
    });

    it("should throw UserNotInOrgError when non-super-user is not in org", async () => {
        const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

        // Mock jwtVerify to return successful verification without super-user permission
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["read:docs"]
            }
        } as any);

        mockVenusClient.organization.isMember.mockResolvedValue({
            ok: true,
            body: false
        });

        await expect(
            authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "test-org"
            })
        ).rejects.toThrow(UserNotInOrgError);

        expect(mockLogger.warn).toHaveBeenCalledWith("User does not belong to organization: test-org");
    });

    it("should throw UnavailableError when Venus returns error for non-super-user", async () => {
        const regularUserToken = createMockJwtWithPermissions(["read:docs"]);

        // Mock jwtVerify to return successful verification without super-user permission
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["read:docs"]
            }
        } as any);

        mockVenusClient.organization.isMember.mockResolvedValue({
            ok: false,
            error: { message: "Service unavailable" }
        });

        await expect(
            authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${regularUserToken}`,
                orgId: "test-org"
            })
        ).rejects.toThrow(UnavailableError);

        expect(mockLogger.error).toHaveBeenCalledWith("Failed to make request to venus", expect.anything());
    });

    it("should check Venus membership for tokens without permissions claim", async () => {
        const tokenWithoutPermissions = createMockJwtWithoutPermissions();

        // Mock jwtVerify to return successful verification without permissions
        mockJwtVerify.mockResolvedValueOnce({
            payload: {}
        } as any);

        mockVenusClient.organization.isMember.mockResolvedValue({
            ok: true,
            body: true
        });

        await expect(
            authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${tokenWithoutPermissions}`,
                orgId: "test-org"
            })
        ).resolves.toBeUndefined();

        expect(mockVenusClient.organization.isMember).toHaveBeenCalled();
    });

    it("should check Venus membership for legacy non-JWT tokens", async () => {
        const legacyToken = "fern_Ngp2jvASiBGMG-BAs9XBsy3sqLY8WruC";

        // Mock jwtVerify to reject for non-JWT tokens
        mockJwtVerify.mockRejectedValueOnce(new Error("Invalid JWT"));

        mockVenusClient.organization.isMember.mockResolvedValue({
            ok: true,
            body: true
        });

        await expect(
            authService.checkUserBelongsToOrg({
                authHeader: `Bearer ${legacyToken}`,
                orgId: "test-org"
            })
        ).resolves.toBeUndefined();

        // Legacy tokens should fall through to Venus check
        expect(mockVenusClient.organization.isMember).toHaveBeenCalled();
    });

    it("should strip Bearer prefix correctly (case insensitive)", async () => {
        const superUserToken = createMockJwtWithPermissions(["super-user"]);

        // Mock jwtVerify to return successful verification with super-user permission
        mockJwtVerify.mockResolvedValueOnce({
            payload: {
                permissions: ["super-user"]
            }
        } as any);

        // Test with lowercase "bearer"
        await authService.checkUserBelongsToOrg({
            authHeader: `bearer ${superUserToken}`,
            orgId: "test-org"
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
            "User has super-user permission, granting access to org test-org"
        );
    });
});
