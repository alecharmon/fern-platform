import { addRoles, getRoles, syncOidcPermissions } from "@fern-api/user-permissions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { attemptGroupPermSync, attemptOrgLevelRole } from "./permission-sync";

vi.mock("@fern-api/user-permissions", () => ({
    syncOidcPermissions: vi.fn(),
    getRoles: vi.fn(),
    addRoles: vi.fn()
}));

vi.mock("@/app/services/auth0/types", () => ({
    Auth0OrgID: (id: string) => id,
    Auth0UserID: (id: string) => id
}));

describe("attemptGroupPermSync", () => {
    const mockSyncOidcPermissions = vi.mocked(syncOidcPermissions);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "info").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("syncs OIDC permissions successfully when synced", async () => {
        mockSyncOidcPermissions.mockResolvedValue({
            synced: true,
            changes: { added: ["editor"], removed: [] }
        });

        await attemptGroupPermSync({
            userId: "user123" as any,
            orgId: "org123" as any,
            connection: "okta-connection"
        });

        expect(mockSyncOidcPermissions).toHaveBeenCalledWith({
            userId: "user123",
            orgId: "org123",
            connectionName: "okta-connection"
        });
        expect(console.info).toHaveBeenCalledWith("Synced OIDC permissions", {
            userId: "user123",
            orgId: "org123",
            connection: "okta-connection",
            changes: { added: ["editor"], removed: [] }
        });
    });

    it("does not log info when sync result is not synced", async () => {
        mockSyncOidcPermissions.mockResolvedValue({
            synced: false,
            reason: "no_oidc_groups"
        });

        await attemptGroupPermSync({
            userId: "user123" as any,
            orgId: "org123" as any,
            connection: "okta-connection"
        });

        expect(mockSyncOidcPermissions).toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
    });

    it("logs error and continues when sync fails", async () => {
        const error = new Error("Sync failed");
        mockSyncOidcPermissions.mockRejectedValue(error);

        await attemptGroupPermSync({
            userId: "user123" as any,
            orgId: "org123" as any,
            connection: "okta-connection"
        });

        expect(console.error).toHaveBeenCalledWith("Failed to sync OIDC permissions", {
            error,
            orgId: "org123",
            userId: "user123",
            connection: "okta-connection"
        });
    });

    it("re-throws redirect errors (Next.js digest)", async () => {
        const redirectError = { digest: "NEXT_REDIRECT" };
        mockSyncOidcPermissions.mockRejectedValue(redirectError);

        await expect(
            attemptGroupPermSync({
                userId: "user123" as any,
                orgId: "org123" as any,
                connection: "okta-connection"
            })
        ).rejects.toEqual(redirectError);

        expect(console.error).not.toHaveBeenCalled();
    });
});

describe("attemptOrgLevelRole", () => {
    const mockGetRoles = vi.mocked(getRoles);
    const mockAddRoles = vi.mocked(addRoles);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("adds default role when user has no roles", async () => {
        mockGetRoles.mockResolvedValue({
            ok: true,
            data: [],
            status: 200
        } as any);
        mockAddRoles.mockResolvedValue({
            ok: true,
            status: 200
        } as any);

        await attemptOrgLevelRole({
            userId: "user123" as any,
            orgId: "org123" as any,
            defaultRole: "viewer"
        });

        expect(mockGetRoles).toHaveBeenCalledWith({
            userId: "user123",
            orgId: "org123"
        });
        expect(mockAddRoles).toHaveBeenCalledWith({
            userId: "user123",
            orgId: "org123",
            roleNames: ["viewer"]
        });
    });

    it("uses editor as default role when defaultRole is undefined", async () => {
        mockGetRoles.mockResolvedValue({
            ok: true,
            data: [],
            status: 200
        } as any);
        mockAddRoles.mockResolvedValue({
            ok: true,
            status: 200
        } as any);

        await attemptOrgLevelRole({
            userId: "user123" as any,
            orgId: "org123" as any,
            defaultRole: undefined
        });

        expect(mockAddRoles).toHaveBeenCalledWith({
            userId: "user123",
            orgId: "org123",
            roleNames: ["editor"]
        });
    });

    it("does not add roles when user already has roles", async () => {
        mockGetRoles.mockResolvedValue({
            ok: true,
            data: ["admin"],
            status: 200
        } as any);

        await attemptOrgLevelRole({
            userId: "user123" as any,
            orgId: "org123" as any,
            defaultRole: "viewer"
        });

        expect(mockGetRoles).toHaveBeenCalled();
        expect(mockAddRoles).not.toHaveBeenCalled();
    });

    it("logs error and returns early when getRoles fails", async () => {
        mockGetRoles.mockResolvedValue({
            ok: false,
            status: 500
        } as any);

        await attemptOrgLevelRole({
            userId: "user123" as any,
            orgId: "org123" as any,
            defaultRole: "viewer"
        });

        expect(console.error).toHaveBeenCalledWith("Failed to check sso roles", {
            orgId: "org123",
            userId: "user123"
        });
        expect(mockAddRoles).not.toHaveBeenCalled();
    });

    it("logs error but continues when addRoles fails", async () => {
        mockGetRoles.mockResolvedValue({
            ok: true,
            data: [],
            status: 200
        } as any);
        mockAddRoles.mockResolvedValue({
            ok: false,
            status: 500
        } as any);

        await attemptOrgLevelRole({
            userId: "user123" as any,
            orgId: "org123" as any,
            defaultRole: "editor"
        });

        expect(mockAddRoles).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith("Failed to add roles to user", {
            orgId: "org123",
            userId: "user123"
        });
    });
});
