import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError, UnavailableError, UserNotInOrgError } from "../../../api/generated/api";
import { AuthServiceImpl, isSuperUser } from "../../../services/auth/AuthService";

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

const MockFernVenusApiClient = vi.mocked(FernVenusApiClient);

describe("isSuperUser", () => {
    it("should return true when token contains super-user permission", () => {
        const token = createMockJwtWithPermissions(["super-user"]);
        expect(isSuperUser(token)).toBe(true);
    });

    it("should return true when super-user is among multiple permissions", () => {
        const token = createMockJwtWithPermissions(["read:docs", "super-user", "write:docs"]);
        expect(isSuperUser(token)).toBe(true);
    });

    it("should return false when token does not contain super-user permission", () => {
        const token = createMockJwtWithPermissions(["read:docs", "write:docs"]);
        expect(isSuperUser(token)).toBe(false);
    });

    it("should return false when permissions array is empty", () => {
        const token = createMockJwtWithPermissions([]);
        expect(isSuperUser(token)).toBe(false);
    });

    it("should return false when token has no permissions claim", () => {
        const token = createMockJwtWithoutPermissions();
        expect(isSuperUser(token)).toBe(false);
    });

    it("should return false for non-JWT tokens", () => {
        expect(isSuperUser("fern_Ngp2jvASiBGMG-BAs9XBsy3sqLY8WruC")).toBe(false);
        expect(isSuperUser("not-a-jwt")).toBe(false);
        expect(isSuperUser("")).toBe(false);
    });

    it("should return false for malformed JWTs", () => {
        expect(isSuperUser("part1.part2")).toBe(false);
        expect(isSuperUser("part1.part2.part3.part4")).toBe(false);
        expect(isSuperUser("invalid.!!!.token")).toBe(false);
    });

    it("should be case-sensitive for permission name", () => {
        const tokenUpperCase = createMockJwtWithPermissions(["SUPER-USER"]);
        expect(isSuperUser(tokenUpperCase)).toBe(false);

        const tokenMixedCase = createMockJwtWithPermissions(["Super-User"]);
        expect(isSuperUser(tokenMixedCase)).toBe(false);
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
