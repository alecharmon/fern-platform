import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LoginAttempt } from "../../redis/cacheKey";
import type { Auth0OrgID, Auth0OrgName } from "../types";

vi.mock("uuid", () => ({
    v4: vi.fn().mockReturnValue("mock-login-attempt-id")
}));

const { redisSet, redisGet, redisDel, getdel } = vi.hoisted(() => ({
    redisSet: vi.fn(),
    redisGet: vi.fn(),
    redisDel: vi.fn(),
    getdel: vi.fn()
}));

vi.mock("../../redis/redis", () => ({
    redisSet,
    redisGet,
    redisDel,
    getRedisClient: () => ({
        getdel
    })
}));

import {
    consumeLoginAttempt,
    createLoginAttempt,
    deleteLoginAttempt,
    getLoginAttempt,
    LOGIN_ATTEMPT_TTL_IN_SECONDS
} from "../loginAttempts";

describe("loginAttempts", () => {
    const loginAttempt: Omit<LoginAttempt, "createdAt"> = {
        email: "user@example.com",
        connection: "okta-connection",
        orgId: "org_123" as Auth0OrgID,
        orgName: "acme" as Auth0OrgName,
        redirectPath: "/login/email/post-sso-redirect"
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("creates and stores a login attempt with a 15 minute ttl", async () => {
        const id = await createLoginAttempt(loginAttempt);

        expect(id).toBe("mock-login-attempt-id");
        expect(redisSet).toHaveBeenCalledWith(
            "login-attempt-mock-login-attempt-id",
            {
                ...loginAttempt,
                createdAt: "2026-01-02T03:04:05.000Z"
            },
            { ttlInSeconds: LOGIN_ATTEMPT_TTL_IN_SECONDS }
        );
        expect(LOGIN_ATTEMPT_TTL_IN_SECONDS).toBe(15 * 60);
    });

    it("gets a login attempt by id", async () => {
        const storedAttempt: LoginAttempt = {
            ...loginAttempt,
            createdAt: "2026-01-02T03:04:05.000Z"
        };
        redisGet.mockResolvedValue(storedAttempt);

        await expect(getLoginAttempt("attempt-123")).resolves.toEqual(storedAttempt);
        expect(redisGet).toHaveBeenCalledWith("login-attempt-attempt-123");
    });

    it("deletes a login attempt by id", async () => {
        await deleteLoginAttempt("attempt-123");

        expect(redisDel).toHaveBeenCalledWith("login-attempt-attempt-123");
    });

    it("consumes a login attempt and deletes it", async () => {
        const storedAttempt: LoginAttempt = {
            ...loginAttempt,
            createdAt: "2026-01-02T03:04:05.000Z"
        };
        getdel.mockResolvedValue(storedAttempt);

        await expect(consumeLoginAttempt("attempt-123")).resolves.toEqual(storedAttempt);

        expect(getdel).toHaveBeenCalledWith("login-attempt-attempt-123");
    });

    it("does not delete when consuming a missing login attempt", async () => {
        getdel.mockResolvedValue(null);

        await expect(consumeLoginAttempt("attempt-123")).resolves.toBeUndefined();

        expect(getdel).toHaveBeenCalledWith("login-attempt-attempt-123");
    });
});
