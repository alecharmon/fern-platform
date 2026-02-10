import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0Organization, Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

vi.mock("@/app/services/auth0/management", () => ({
    getMyOrganizations: vi.fn(),
    getOrganization: vi.fn(),
    isSuperUser: vi.fn()
}));

import * as auth0Management from "@/app/services/auth0/management";

import handler from "../handler";

const mockGetMyOrganizations = auth0Management.getMyOrganizations as Mock;
const mockGetOrganization = auth0Management.getOrganization as Mock;
const mockIsSuperUser = auth0Management.isSuperUser as Mock;

const userId = "auth0|user-123" as Auth0UserID;

function makeOrg(name: string): Auth0Organization {
    return {
        id: `org_${name}` as Auth0Organization["id"],
        name: name as Auth0OrgName,
        display_name: name
    };
}

describe("getMyOrganizations handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetMyOrganizations.mockResolvedValue([makeOrg("my-org")]);
        mockIsSuperUser.mockReturnValue(false);
    });

    it("returns the user's organizations without options", async () => {
        const result = await handler(userId);

        expect(result).toEqual([makeOrg("my-org")]);
        expect(mockGetMyOrganizations).toHaveBeenCalledWith(userId);
        expect(mockGetOrganization).not.toHaveBeenCalled();
    });

    it("returns the user's organizations when no orgName is provided", async () => {
        const result = await handler(userId, { permissions: ["super-user"] });

        expect(result).toEqual([makeOrg("my-org")]);
        expect(mockGetOrganization).not.toHaveBeenCalled();
    });

    it("does not fetch extra org for non-super users", async () => {
        mockIsSuperUser.mockReturnValue(false);

        const result = await handler(userId, {
            orgName: "other-org" as Auth0OrgName,
            permissions: ["read:docs"]
        });

        expect(result).toEqual([makeOrg("my-org")]);
        expect(mockGetOrganization).not.toHaveBeenCalled();
    });

    it("does not fetch extra org if super user already belongs to it", async () => {
        mockIsSuperUser.mockReturnValue(true);

        const result = await handler(userId, {
            orgName: "my-org" as Auth0OrgName,
            permissions: ["super-user"]
        });

        expect(result).toEqual([makeOrg("my-org")]);
        expect(mockGetOrganization).not.toHaveBeenCalled();
    });

    it("fetches and appends org for super user viewing an org they don't belong to", async () => {
        mockIsSuperUser.mockReturnValue(true);
        mockGetOrganization.mockResolvedValue(makeOrg("other-org"));

        const result = await handler(userId, {
            orgName: "other-org" as Auth0OrgName,
            permissions: ["super-user"]
        });

        expect(result).toEqual([makeOrg("my-org"), makeOrg("other-org")]);
        expect(mockGetOrganization).toHaveBeenCalledWith("other-org");
    });

    it("handles getOrganization failure gracefully for super users", async () => {
        mockIsSuperUser.mockReturnValue(true);
        mockGetOrganization.mockRejectedValue(new Error("org not found"));
        vi.spyOn(console, "error").mockImplementation(() => {});

        const result = await handler(userId, {
            orgName: "nonexistent-org" as Auth0OrgName,
            permissions: ["super-user"]
        });

        expect(result).toEqual([makeOrg("my-org")]);
        expect(mockGetOrganization).toHaveBeenCalledWith("nonexistent-org");
    });

    it("does not fetch extra org when permissions are not provided", async () => {
        const result = await handler(userId, {
            orgName: "other-org" as Auth0OrgName
        });

        expect(result).toEqual([makeOrg("my-org")]);
        expect(mockIsSuperUser).not.toHaveBeenCalled();
        expect(mockGetOrganization).not.toHaveBeenCalled();
    });
});
