import { EVERYONE_ROLE } from "@fern-api/docs-utils";
import { describe, expect, it } from "vitest";
import { buildRoleSets } from "./build-role-sets";

describe("buildRoleSets", () => {
    it("should return only [EVERYONE] when no roles provided", () => {
        const result = buildRoleSets([]);
        expect(result).toEqual([[EVERYONE_ROLE]]);
    });

    it("should return only [EVERYONE] when only EVERYONE role provided", () => {
        const result = buildRoleSets([EVERYONE_ROLE]);
        expect(result).toEqual([[EVERYONE_ROLE]]);
    });

    it("should generate single role set for one role", () => {
        const result = buildRoleSets(["admin"]);
        expect(result).toEqual([[EVERYONE_ROLE], [EVERYONE_ROLE, "admin"]]);
    });

    it("should generate all combinations for two roles", () => {
        const result = buildRoleSets(["admin", "developer"]);
        expect(result).toEqual(
            expect.arrayContaining([
                [EVERYONE_ROLE],
                [EVERYONE_ROLE, "admin"],
                [EVERYONE_ROLE, "developer"],
                [EVERYONE_ROLE, "admin", "developer"]
            ])
        );
        expect(result).toHaveLength(4);
    });

    it("should generate all combinations for three roles (admin, developer, viewer)", () => {
        const result = buildRoleSets(["admin", "developer", "viewer"]);
        expect(result).toEqual(
            expect.arrayContaining([
                [EVERYONE_ROLE],
                [EVERYONE_ROLE, "admin"],
                [EVERYONE_ROLE, "developer"],
                [EVERYONE_ROLE, "viewer"],
                [EVERYONE_ROLE, "admin", "developer"],
                [EVERYONE_ROLE, "admin", "viewer"],
                [EVERYONE_ROLE, "developer", "viewer"],
                [EVERYONE_ROLE, "admin", "developer", "viewer"]
            ])
        );
        expect(result).toHaveLength(8);
    });

    it("should filter out EVERYONE from input roles before generating combinations", () => {
        const result = buildRoleSets([EVERYONE_ROLE, "admin", "developer"]);
        expect(result).toEqual(
            expect.arrayContaining([
                [EVERYONE_ROLE],
                [EVERYONE_ROLE, "admin"],
                [EVERYONE_ROLE, "developer"],
                [EVERYONE_ROLE, "admin", "developer"]
            ])
        );
        expect(result).toHaveLength(4);
    });

    it("should accept a Set as input", () => {
        const roles = new Set(["admin", "developer"]);
        const result = buildRoleSets(roles);
        expect(result).toEqual(
            expect.arrayContaining([
                [EVERYONE_ROLE],
                [EVERYONE_ROLE, "admin"],
                [EVERYONE_ROLE, "developer"],
                [EVERYONE_ROLE, "admin", "developer"]
            ])
        );
        expect(result).toHaveLength(4);
    });

    it("should alpha-sort roles within each subset regardless of input order", () => {
        // Input in reverse-alphabetical order
        const result = buildRoleSets(["viewer", "developer", "admin"]);
        // Every subset should have roles in alphabetical order
        for (const subset of result) {
            const rolesOnly = subset.filter((r) => r !== EVERYONE_ROLE);
            const sorted = [...rolesOnly].sort();
            expect(rolesOnly).toEqual(sorted);
        }
        // Verify specific subsets are alpha-sorted
        expect(result).toEqual(
            expect.arrayContaining([
                [EVERYONE_ROLE, "admin", "developer"],
                [EVERYONE_ROLE, "admin", "viewer"],
                [EVERYONE_ROLE, "developer", "viewer"],
                [EVERYONE_ROLE, "admin", "developer", "viewer"]
            ])
        );
        expect(result).toHaveLength(8);
    });
});
