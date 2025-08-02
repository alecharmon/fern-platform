import { describe, expect, it } from "vitest";

import type { FernUser } from "@fern-api/docs-auth";

import { hasRequiredRole } from "./TableOfContents";

describe("hasRequiredRole", () => {
  describe("when roleRequirements is undefined", () => {
    it("should return true", () => {
      const user: FernUser = { roles: ["admin"] };
      expect(hasRequiredRole(user, undefined)).toBe(true);
    });
  });

  describe("when roleRequirements is empty array", () => {
    it("should return true", () => {
      const user: FernUser = { roles: ["admin"] };
      expect(hasRequiredRole(user, [])).toBe(true);
    });
  });

  describe("single requirement", () => {
    describe("roles", () => {
      it("should return true when user has required role", () => {
        const user: FernUser = { roles: ["admin"] };
        const requirements = [{ roles: ["admin"] }];
        expect(hasRequiredRole(user, requirements)).toBe(true);
      });

      it("should return true when user has 'everyone' role", () => {
        const user: FernUser = { roles: ["user"] };
        const requirements = [{ roles: ["everyone"] }];
        expect(hasRequiredRole(user, requirements)).toBe(true);
      });

      it("should return false when user doesn't have required role", () => {
        const user: FernUser = { roles: ["user"] };
        const requirements = [{ roles: ["admin"] }];
        expect(hasRequiredRole(user, requirements)).toBe(false);
      });

      it("should return true when roles array is empty and user is logged in", () => {
        const user: FernUser = { roles: ["user"] };
        const requirements = [{ roles: [] }];
        expect(hasRequiredRole(user, requirements)).toBe(true);
      });

      it("should return false when roles array is empty and user is not logged in", () => {
        const requirements = [{ roles: [] }];
        expect(hasRequiredRole(undefined, requirements)).toBe(false);
      });
    });

    describe("not prop", () => {
      it("should return false when user has role but not=true", () => {
        const user: FernUser = { roles: ["admin"] };
        const requirements = [{ roles: ["admin"], not: true }];
        expect(hasRequiredRole(user, requirements)).toBe(false);
      });

      it("should return true when user doesn't have role and not=true", () => {
        const user: FernUser = { roles: ["user"] };
        const requirements = [{ roles: ["admin"], not: true }];
        expect(hasRequiredRole(user, requirements)).toBe(true);
      });

      it("should return true when user has role and not=false", () => {
        const user: FernUser = { roles: ["admin"] };
        const requirements = [{ roles: ["admin"], not: false }];
        expect(hasRequiredRole(user, requirements)).toBe(true);
      });

      it("should return false when user doesn't have role and not=false", () => {
        const user: FernUser = { roles: ["user"] };
        const requirements = [{ roles: ["admin"], not: false }];
        expect(hasRequiredRole(user, requirements)).toBe(false);
      });
    });

    describe("loggedIn", () => {
      it("should return true when loggedIn=true and user is logged in", () => {
        const user: FernUser = { roles: ["user"] };
        const requirements = [{ loggedIn: true }];
        expect(hasRequiredRole(user, requirements)).toBe(true);
      });

      it("should return false when loggedIn=true and user is not logged in", () => {
        const requirements = [{ loggedIn: true }];
        expect(hasRequiredRole(undefined, requirements)).toBe(false);
      });

      it("should return false when loggedIn=false and user is logged in", () => {
        const user: FernUser = { roles: ["user"] };
        const requirements = [{ loggedIn: false }];
        expect(hasRequiredRole(user, requirements)).toBe(false);
      });

      it("should return true when loggedIn=false and user is not logged in", () => {
        const requirements = [{ loggedIn: false }];
        expect(hasRequiredRole(undefined, requirements)).toBe(true);
      });
    });
  });

  describe("multiple requirements", () => {
    it("should return true when all requirements are satisfied", () => {
      const user: FernUser = { roles: ["admin"] };
      const requirements = [{ roles: ["admin"] }, { loggedIn: true }];
      expect(hasRequiredRole(user, requirements)).toBe(true);
    });

    it("should return false when any requirement is not satisfied", () => {
      const user: FernUser = { roles: ["user"] };
      const requirements = [{ roles: ["admin"] }, { loggedIn: true }];
      expect(hasRequiredRole(user, requirements)).toBe(false);
    });

    // this is relevant for nested if statements
    it("should handle mixed not requirements correctly", () => {
      const user1: FernUser = { roles: ["admin"] };
      const user2: FernUser = { roles: ["admin", "user"] };
      const requirements = [
        { roles: ["admin"] },
        { roles: ["user"], not: true },
      ];
      expect(hasRequiredRole(user1, requirements)).toBe(true);
      expect(hasRequiredRole(user2, requirements)).toBe(false);
    });

    it("should handle complex not scenarios", () => {
      const user1: FernUser = { roles: ["admin"] };
      const user2: FernUser = { roles: ["admin", "beta"] };
      const requirements = [
        { roles: ["admin"] },
        { roles: ["beta"], not: true },
      ];
      expect(hasRequiredRole(user1, requirements)).toBe(true);
      expect(hasRequiredRole(user2, requirements)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty roles array with not", () => {
      const user: FernUser = { roles: ["user"] };
      const requirements = [{ roles: [], not: true }];
      // true to match the behavior of if.tsx
      expect(hasRequiredRole(user, requirements)).toBe(true);
      expect(hasRequiredRole(undefined, requirements)).toBe(true);
    });

    it("should handle multiple roles with not", () => {
      const adminUser: FernUser = { roles: ["admin"] };
      const userUser: FernUser = { roles: ["user"] };
      const guestUser: FernUser = { roles: ["guest"] };
      const requirements = [{ roles: ["admin", "user"], not: true }];
      expect(hasRequiredRole(adminUser, requirements)).toBe(false);
      expect(hasRequiredRole(userUser, requirements)).toBe(false);
      expect(hasRequiredRole(guestUser, requirements)).toBe(true);
    });
  });
});
