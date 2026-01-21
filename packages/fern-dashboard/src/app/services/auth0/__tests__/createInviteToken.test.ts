import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Auth0OrgName } from "../types";

// Mock uuid
vi.mock("uuid", () => ({
    v4: vi.fn().mockReturnValue("mock-uuid-token")
}));

// Store reference to the set function spy
let setCalls: Array<{ key: string; value: unknown }> = [];

// Mock AsyncRedisCache with factory function to avoid hoisting issues
vi.mock("../../redis/AsyncRedisCache", () => {
    return {
        AsyncRedisCache: class MockAsyncRedisCache {
            async set(key: string, value: unknown) {
                setCalls.push({ key, value });
            }
            async get() {
                return undefined;
            }
            async getDirectly() {
                return undefined;
            }
            async invalidate() {
                return undefined;
            }
        }
    };
});

// Import after mocks are set up
import { createInviteToken } from "../management";

describe("createInviteToken", () => {
    const orgName = "test-org" as Auth0OrgName;
    const inviterId = "auth0|inviter-123";

    beforeEach(() => {
        setCalls = [];
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("creates invite token without roles", async () => {
        const result = await createInviteToken(orgName, inviterId);

        expect(result.token).toBe("mock-uuid-token");
        expect(result.expiresAt).toBe("2024-01-16T12:00:00.000Z"); // 24 hours later

        expect(setCalls.length).toBe(1);
        expect(setCalls[0]!.value).toMatchObject({
            orgName,
            inviterId,
            createdAt: "2024-01-15T12:00:00.000Z",
            expiresAt: "2024-01-16T12:00:00.000Z",
            roles: undefined
        });
    });

    it("creates invite token with viewer role", async () => {
        const roles: ("admin" | "editor" | "viewer" | "cli")[] = ["viewer"];

        const result = await createInviteToken(orgName, inviterId, roles);

        expect(result.token).toBe("mock-uuid-token");
        expect(setCalls.length).toBe(1);
        expect(setCalls[0]!.value).toMatchObject({
            orgName,
            inviterId,
            roles: ["viewer"]
        });
    });

    it("creates invite token with editor role", async () => {
        const roles: ("admin" | "editor" | "viewer" | "cli")[] = ["editor"];

        await createInviteToken(orgName, inviterId, roles);

        expect(setCalls.length).toBe(1);
        expect(setCalls[0]!.value).toMatchObject({
            roles: ["editor"]
        });
    });

    it("creates invite token with admin role", async () => {
        const roles: ("admin" | "editor" | "viewer" | "cli")[] = ["admin"];

        await createInviteToken(orgName, inviterId, roles);

        expect(setCalls.length).toBe(1);
        expect(setCalls[0]!.value).toMatchObject({
            roles: ["admin"]
        });
    });

    it("creates invite token with editor role and CLI access", async () => {
        const roles: ("admin" | "editor" | "viewer" | "cli")[] = ["editor", "cli"];

        await createInviteToken(orgName, inviterId, roles);

        expect(setCalls.length).toBe(1);
        expect(setCalls[0]!.value).toMatchObject({
            roles: ["editor", "cli"]
        });
    });

    it("creates invite token with viewer role and CLI access", async () => {
        const roles: ("admin" | "editor" | "viewer" | "cli")[] = ["viewer", "cli"];

        await createInviteToken(orgName, inviterId, roles);

        expect(setCalls.length).toBe(1);
        expect(setCalls[0]!.value).toMatchObject({
            roles: ["viewer", "cli"]
        });
    });

    it("creates invite token with empty roles array", async () => {
        const roles: ("admin" | "editor" | "viewer" | "cli")[] = [];

        await createInviteToken(orgName, inviterId, roles);

        expect(setCalls.length).toBe(1);
        expect(setCalls[0]!.value).toMatchObject({
            roles: []
        });
    });

    it("sets correct expiration time (24 hours)", async () => {
        const result = await createInviteToken(orgName, inviterId);

        const createdAt = new Date("2024-01-15T12:00:00.000Z");
        const expiresAt = new Date(result.expiresAt);
        const diff = expiresAt.getTime() - createdAt.getTime();

        expect(diff).toBe(24 * 60 * 60 * 1000); // 24 hours in milliseconds
    });
});
