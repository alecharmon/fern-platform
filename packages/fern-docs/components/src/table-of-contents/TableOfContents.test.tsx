import { EVERYONE_ROLE } from "@fern-api/docs-utils";
import { describe, expect, it } from "vitest";

import { hasRequiredRole } from "./TableOfContents";

/**
 * In the new roles-based approach:
 * - `[EVERYONE_ROLE]` = not logged in, only has the everyone role
 * - `["role1", EVERYONE_ROLE]` = logged in with specific roles, plus EVERYONE_ROLE
 *
 * Note: In the new approach, "logged in" is determined by the isLoggedIn parameter,
 * not by the roles array.
 */

describe("hasRequiredRole", () => {
    describe("when roleRequirements is undefined", () => {
        it("should return true", () => {
            const roles = ["admin", EVERYONE_ROLE];
            expect(hasRequiredRole(roles, true, undefined)).toBe(true);
        });
    });

    describe("when roleRequirements is empty array", () => {
        it("should return true", () => {
            const roles = ["admin", EVERYONE_ROLE];
            expect(hasRequiredRole(roles, true, [])).toBe(true);
        });
    });

    describe("single requirement", () => {
        describe("roles", () => {
            it("should return true when user has required role", () => {
                const roles = ["admin", EVERYONE_ROLE];
                const requirements = [{ roles: ["admin"] }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(true);
            });

            it("should return true when user has 'everyone' role", () => {
                const roles = ["user", EVERYONE_ROLE];
                const requirements = [{ roles: ["everyone"] }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(true);
            });

            it("should return false when user doesn't have required role", () => {
                const roles = ["user", EVERYONE_ROLE];
                const requirements = [{ roles: ["admin"] }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(false);
            });

            it("should return true when roles array is empty and user is logged in", () => {
                const roles = ["user", EVERYONE_ROLE];
                const requirements = [{ roles: [] }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(true);
            });

            it("should return false when roles array is empty and user is not logged in", () => {
                const roles = [EVERYONE_ROLE]; // not logged in
                const requirements = [{ roles: [] }];
                expect(hasRequiredRole(roles, false, requirements)).toBe(false);
            });
        });

        describe("not prop", () => {
            it("should return false when user has role but not=true", () => {
                const roles = ["admin", EVERYONE_ROLE];
                const requirements = [{ roles: ["admin"], not: true }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(false);
            });

            it("should return true when user doesn't have role and not=true", () => {
                const roles = ["user", EVERYONE_ROLE];
                const requirements = [{ roles: ["admin"], not: true }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(true);
            });

            it("should return true when user has role and not=false", () => {
                const roles = ["admin", EVERYONE_ROLE];
                const requirements = [{ roles: ["admin"], not: false }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(true);
            });

            it("should return false when user doesn't have role and not=false", () => {
                const roles = ["user", EVERYONE_ROLE];
                const requirements = [{ roles: ["admin"], not: false }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(false);
            });
        });

        describe("loggedIn", () => {
            it("should return true when loggedIn=true and user is logged in", () => {
                const roles = ["user", EVERYONE_ROLE];
                const requirements = [{ loggedIn: true }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(true);
            });

            it("should return false when loggedIn=true and user is not logged in", () => {
                const roles = [EVERYONE_ROLE]; // not logged in
                const requirements = [{ loggedIn: true }];
                expect(hasRequiredRole(roles, false, requirements)).toBe(false);
            });

            it("should return false when loggedIn=false and user is logged in", () => {
                const roles = ["user", EVERYONE_ROLE];
                const requirements = [{ loggedIn: false }];
                expect(hasRequiredRole(roles, true, requirements)).toBe(false);
            });

            it("should return true when loggedIn=false and user is not logged in", () => {
                const roles = [EVERYONE_ROLE]; // not logged in
                const requirements = [{ loggedIn: false }];
                expect(hasRequiredRole(roles, false, requirements)).toBe(true);
            });
        });
    });

    describe("multiple requirements", () => {
        it("should return true when all requirements are satisfied", () => {
            const roles = ["admin", EVERYONE_ROLE];
            const requirements = [{ roles: ["admin"] }, { loggedIn: true }];
            expect(hasRequiredRole(roles, true, requirements)).toBe(true);
        });

        it("should return false when any requirement is not satisfied", () => {
            const roles = ["user", EVERYONE_ROLE];
            const requirements = [{ roles: ["admin"] }, { loggedIn: true }];
            expect(hasRequiredRole(roles, true, requirements)).toBe(false);
        });

        // this is relevant for nested if statements
        it("should handle mixed not requirements correctly", () => {
            const roles1 = ["admin", EVERYONE_ROLE];
            const roles2 = ["admin", "user", EVERYONE_ROLE];
            const requirements = [{ roles: ["admin"] }, { roles: ["user"], not: true }];
            expect(hasRequiredRole(roles1, true, requirements)).toBe(true);
            expect(hasRequiredRole(roles2, true, requirements)).toBe(false);
        });

        it("should handle complex not scenarios", () => {
            const roles1 = ["admin", EVERYONE_ROLE];
            const roles2 = ["admin", "beta", EVERYONE_ROLE];
            const requirements = [{ roles: ["admin"] }, { roles: ["beta"], not: true }];
            expect(hasRequiredRole(roles1, true, requirements)).toBe(true);
            expect(hasRequiredRole(roles2, true, requirements)).toBe(false);
        });
    });

    describe("edge cases", () => {
        it("should handle empty roles array with not", () => {
            const roles = ["user", EVERYONE_ROLE];
            const notLoggedInRoles = [EVERYONE_ROLE];
            const requirements = [{ roles: [], not: true }];
            // true to match the behavior of if.tsx
            expect(hasRequiredRole(roles, true, requirements)).toBe(true);
            expect(hasRequiredRole(notLoggedInRoles, false, requirements)).toBe(true);
        });

        it("should handle multiple roles with not", () => {
            const adminRoles = ["admin", EVERYONE_ROLE];
            const userRoles = ["user", EVERYONE_ROLE];
            const guestRoles = ["guest", EVERYONE_ROLE];
            const requirements = [{ roles: ["admin", "user"], not: true }];
            expect(hasRequiredRole(adminRoles, true, requirements)).toBe(false);
            expect(hasRequiredRole(userRoles, true, requirements)).toBe(false);
            expect(hasRequiredRole(guestRoles, true, requirements)).toBe(true);
        });
    });
});
