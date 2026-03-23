import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName } from "@/app/services/auth0/types";

vi.mock("@/app/services/auth0/management", () => ({
    getOrgMembers: vi.fn()
}));

vi.mock("@/app/services/redis/redis", () => ({
    redisSet: vi.fn()
}));

vi.mock("@/app/services/redis/cacheKey", () => ({
    RedisCacheKey: {
        userSessionInvalidated: (userId: string) => `user-session-invalidated-${userId}`
    }
}));

import { getOrgMembers } from "@/app/services/auth0/management";
import { redisSet } from "@/app/services/redis/redis";
import { invalidateOrgSessions } from "../_utils/invalidateOrgSessions";

const mockGetOrgMembers = getOrgMembers as Mock;
const mockRedisSet = redisSet as Mock;

const orgName = "test-org" as Auth0OrgName;

describe("invalidateOrgSessions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOrgMembers.mockResolvedValue([]);
        mockRedisSet.mockResolvedValue(undefined);
    });

    it("fetches org members including fern employees", async () => {
        await invalidateOrgSessions(orgName);

        expect(mockGetOrgMembers).toHaveBeenCalledWith(orgName, { includeFernEmployees: true });
    });

    it("sets session invalidation key for each member", async () => {
        mockGetOrgMembers.mockResolvedValue([
            { user_id: "auth0|user-1" },
            { user_id: "auth0|user-2" },
            { user_id: "auth0|user-3" }
        ]);

        await invalidateOrgSessions(orgName);

        expect(mockRedisSet).toHaveBeenCalledTimes(3);
        expect(mockRedisSet).toHaveBeenCalledWith(
            "user-session-invalidated-auth0|user-1",
            true,
            { ttlInSeconds: 60 * 60 * 24 * 365 }
        );
        expect(mockRedisSet).toHaveBeenCalledWith(
            "user-session-invalidated-auth0|user-2",
            true,
            { ttlInSeconds: 60 * 60 * 24 * 365 }
        );
        expect(mockRedisSet).toHaveBeenCalledWith(
            "user-session-invalidated-auth0|user-3",
            true,
            { ttlInSeconds: 60 * 60 * 24 * 365 }
        );
    });

    it("does nothing when org has no members", async () => {
        mockGetOrgMembers.mockResolvedValue([]);

        await invalidateOrgSessions(orgName);

        expect(mockRedisSet).not.toHaveBeenCalled();
    });
});
