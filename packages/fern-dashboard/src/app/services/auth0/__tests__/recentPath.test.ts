import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRecentPath } from "../../redis/cacheKey";

const { redisSet, redisGet } = vi.hoisted(() => ({
    redisSet: vi.fn(),
    redisGet: vi.fn()
}));

vi.mock("../../redis/redis", () => ({
    redisSet,
    redisGet
}));

import { getRecentPath, RECENT_PATH_TTL_IN_SECONDS, setRecentPath } from "../recentPath";

describe("recentPath", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("has a 7-day TTL", () => {
        expect(RECENT_PATH_TTL_IN_SECONDS).toBe(7 * 24 * 60 * 60);
    });

    it("stores a recent path with org name extracted from path", async () => {
        await setRecentPath("user_123", "/acme/docs/site.docs.buildwithfern.com");

        expect(redisSet).toHaveBeenCalledWith(
            "user-recent-path-user_123",
            {
                path: "/acme/docs/site.docs.buildwithfern.com",
                orgName: "acme",
                updatedAt: "2026-01-02T03:04:05.000Z"
            },
            { ttlInSeconds: 7 * 24 * 60 * 60 }
        );
    });

    it("retrieves a recent path by user id", async () => {
        const stored: UserRecentPath = {
            path: "/acme/docs",
            orgName: "acme",
            updatedAt: "2026-01-02T03:04:05.000Z"
        };
        redisGet.mockResolvedValue(stored);

        await expect(getRecentPath("user_123")).resolves.toEqual(stored);
        expect(redisGet).toHaveBeenCalledWith("user-recent-path-user_123");
    });

    it("returns undefined when no recent path exists", async () => {
        redisGet.mockResolvedValue(undefined);

        await expect(getRecentPath("user_123")).resolves.toBeUndefined();
    });

    it("does not store when path has no org segment", async () => {
        await setRecentPath("user_123", "/");

        expect(redisSet).not.toHaveBeenCalled();
    });

    it("does not store when path is empty", async () => {
        await setRecentPath("user_123", "");

        expect(redisSet).not.toHaveBeenCalled();
    });
});
