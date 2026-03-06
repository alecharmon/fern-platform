import { EVERYONE_ROLE } from "@fern-api/docs-utils";
import { describe, expect, it, vi } from "vitest";
import {
    buildRolesHeader,
    type FetchForRoleSet,
    processRoleSets,
    type RoleSetProcessingResult,
    shouldRetrySlug
} from "./process-role-sets";

describe("processRoleSets", () => {
    it("should succeed for all role sets when fetch returns 200", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockResolvedValue({ ok: true, status: 200 });

        const result = await processRoleSets(
            [[EVERYONE_ROLE], [EVERYONE_ROLE, "europe"], [EVERYONE_ROLE, "asia"]],
            fetchFn
        );

        expect(result.succeeded).toBe(3);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("should skip 404 responses (role lacks access) and continue to next role sets", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockImplementation(async (roleSet: string[]) => {
            // "everyone" gets 404 (page is role-restricted), "europe" succeeds
            if (roleSet.length === 1 && roleSet[0] === EVERYONE_ROLE) {
                return { ok: false, status: 404 };
            }
            return { ok: true, status: 200 };
        });

        const result = await processRoleSets(
            [[EVERYONE_ROLE], [EVERYONE_ROLE, "europe"], [EVERYONE_ROLE, "asia"]],
            fetchFn
        );

        expect(result.succeeded).toBe(2);
        expect(result.skipped).toBe(1);
        expect(result.errors).toHaveLength(0);
        // All 3 role sets should have been attempted
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("should collect non-404 errors without aborting remaining role sets", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockImplementation(async (roleSet: string[]) => {
            if (roleSet.length === 1 && roleSet[0] === EVERYONE_ROLE) {
                return { ok: false, status: 500 };
            }
            return { ok: true, status: 200 };
        });

        const result = await processRoleSets(
            [[EVERYONE_ROLE], [EVERYONE_ROLE, "europe"], [EVERYONE_ROLE, "asia"]],
            fetchFn
        );

        expect(result.succeeded).toBe(2);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.roleSet).toEqual([EVERYONE_ROLE]);
        // All role sets should still be attempted
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("should handle network errors (thrown exceptions) without aborting remaining role sets", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockImplementation(async (roleSet: string[]) => {
            if (roleSet.includes("europe")) {
                throw new Error("Network timeout");
            }
            return { ok: true, status: 200 };
        });

        const result = await processRoleSets(
            [[EVERYONE_ROLE], [EVERYONE_ROLE, "europe"], [EVERYONE_ROLE, "asia"]],
            fetchFn
        );

        expect(result.succeeded).toBe(2);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.error.message).toBe("Network timeout");
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("should handle all role sets returning 404 (all skipped, no errors)", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockResolvedValue({ ok: false, status: 404 });

        const result = await processRoleSets(
            [[EVERYONE_ROLE], [EVERYONE_ROLE, "europe"]],
            fetchFn
        );

        expect(result.succeeded).toBe(0);
        expect(result.skipped).toBe(2);
        expect(result.errors).toHaveLength(0);
    });

    it("should handle all role sets failing with non-404 errors", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockResolvedValue({ ok: false, status: 500 });

        const result = await processRoleSets(
            [[EVERYONE_ROLE], [EVERYONE_ROLE, "europe"]],
            fetchFn
        );

        expect(result.succeeded).toBe(0);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(2);
    });

    it("should handle mixed 404s and real errors", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockImplementation(async (roleSet: string[]) => {
            if (roleSet.includes("europe")) {
                return { ok: false, status: 404 }; // expected — role lacks access
            }
            if (roleSet.includes("asia")) {
                return { ok: false, status: 500 }; // real error
            }
            return { ok: true, status: 200 };
        });

        const result = await processRoleSets(
            [[EVERYONE_ROLE], [EVERYONE_ROLE, "europe"], [EVERYONE_ROLE, "asia"]],
            fetchFn
        );

        expect(result.succeeded).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.roleSet).toEqual([EVERYONE_ROLE, "asia"]);
    });

    it("should handle non-Error thrown values", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockImplementation(async () => {
            throw "string error";
        });

        const result = await processRoleSets([[EVERYONE_ROLE]], fetchFn);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.error).toBeInstanceOf(Error);
        expect(result.errors[0]?.error.message).toBe("string error");
    });

    it("should handle a single role set", async () => {
        const fetchFn: FetchForRoleSet = vi.fn().mockResolvedValue({ ok: true, status: 200 });

        const result = await processRoleSets([[EVERYONE_ROLE]], fetchFn);

        expect(result.succeeded).toBe(1);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(0);
    });

    it("should handle empty role sets array", async () => {
        const fetchFn: FetchForRoleSet = vi.fn();

        const result = await processRoleSets([], fetchFn);

        expect(result.succeeded).toBe(0);
        expect(result.skipped).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(fetchFn).not.toHaveBeenCalled();
    });
});

describe("shouldRetrySlug", () => {
    it("should not retry when at least one role set succeeded", () => {
        const result: RoleSetProcessingResult = {
            succeeded: 1,
            skipped: 0,
            errors: [{ roleSet: [EVERYONE_ROLE], error: new Error("500") }]
        };
        expect(shouldRetrySlug(result)).toBe(false);
    });

    it("should not retry when all role sets were skipped (404)", () => {
        const result: RoleSetProcessingResult = {
            succeeded: 0,
            skipped: 3,
            errors: []
        };
        expect(shouldRetrySlug(result)).toBe(false);
    });

    it("should not retry when some succeeded and some were skipped", () => {
        const result: RoleSetProcessingResult = {
            succeeded: 1,
            skipped: 2,
            errors: []
        };
        expect(shouldRetrySlug(result)).toBe(false);
    });

    it("should retry when all role sets failed with non-404 errors", () => {
        const result: RoleSetProcessingResult = {
            succeeded: 0,
            skipped: 0,
            errors: [
                { roleSet: [EVERYONE_ROLE], error: new Error("500") },
                { roleSet: [EVERYONE_ROLE, "europe"], error: new Error("500") }
            ]
        };
        expect(shouldRetrySlug(result)).toBe(true);
    });

    it("should not retry when there are skips and errors but no successes", () => {
        const result: RoleSetProcessingResult = {
            succeeded: 0,
            skipped: 1,
            errors: [{ roleSet: [EVERYONE_ROLE, "europe"], error: new Error("500") }]
        };
        expect(shouldRetrySlug(result)).toBe(false);
    });

    it("should not retry when there are no results at all", () => {
        const result: RoleSetProcessingResult = {
            succeeded: 0,
            skipped: 0,
            errors: []
        };
        expect(shouldRetrySlug(result)).toBe(false);
    });
});

describe("buildRolesHeader", () => {
    it("should return empty string for everyone-only role set", () => {
        expect(buildRolesHeader([EVERYONE_ROLE])).toBe("");
    });

    it("should return roles header for a single non-everyone role", () => {
        expect(buildRolesHeader([EVERYONE_ROLE, "europe"])).toBe(",roles:europe");
    });

    it("should return pipe-delimited roles header for multiple roles", () => {
        expect(buildRolesHeader([EVERYONE_ROLE, "europe", "asia"])).toBe(",roles:europe|asia");
    });

    it("should handle role set without EVERYONE_ROLE", () => {
        expect(buildRolesHeader(["admin", "viewer"])).toBe(",roles:admin|viewer");
    });

    it("should handle empty role set", () => {
        expect(buildRolesHeader([])).toBe("");
    });
});
