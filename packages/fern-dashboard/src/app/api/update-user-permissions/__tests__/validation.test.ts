import { describe, expect, it } from "vitest";

import { validatePermissions } from "../validation";

describe("validatePermissions", () => {
    describe("org-level permissions", () => {
        it("accepts valid admin role", () => {
            const result = validatePermissions({
                type: "org",
                role: "admin",
                cliEnabled: false
            });

            expect(result).toEqual({ valid: true });
        });

        it("accepts valid editor role without CLI", () => {
            const result = validatePermissions({
                type: "org",
                role: "editor",
                cliEnabled: false
            });

            expect(result).toEqual({ valid: true });
        });

        it("accepts valid editor role with CLI enabled", () => {
            const result = validatePermissions({
                type: "org",
                role: "editor",
                cliEnabled: true
            });

            expect(result).toEqual({ valid: true });
        });

        it("accepts valid viewer role", () => {
            const result = validatePermissions({
                type: "org",
                role: "viewer",
                cliEnabled: false
            });

            expect(result).toEqual({ valid: true });
        });

        it("rejects cliEnabled for admin role", () => {
            const result = validatePermissions({
                type: "org",
                role: "admin",
                cliEnabled: true
            });

            expect(result).toEqual({
                valid: false,
                code: "invalid_permissions",
                message: "CLI access can only be enabled for the editor role. Admins have implicit CLI access."
            });
        });

        it("rejects cliEnabled for viewer role", () => {
            const result = validatePermissions({
                type: "org",
                role: "viewer",
                cliEnabled: true
            });

            expect(result).toEqual({
                valid: false,
                code: "invalid_permissions",
                message: "CLI access can only be enabled for the editor role. Admins have implicit CLI access."
            });
        });
    });

    describe("fine-grained permissions", () => {
        it("accepts valid fine-grained with one resource role", () => {
            const result = validatePermissions({
                type: "fine-grained",
                resourceRoles: {
                    "docs.example.com": { role: "editor", cliEnabled: false }
                }
            });

            expect(result).toEqual({ valid: true });
        });

        it("accepts valid fine-grained with multiple resource roles", () => {
            const result = validatePermissions({
                type: "fine-grained",
                resourceRoles: {
                    "docs.example.com": { role: "admin", cliEnabled: false },
                    "api.example.com": { role: "viewer", cliEnabled: false }
                }
            });

            expect(result).toEqual({ valid: true });
        });

        it("accepts editor role with CLI enabled", () => {
            const result = validatePermissions({
                type: "fine-grained",
                resourceRoles: {
                    "docs.example.com": { role: "editor", cliEnabled: true }
                }
            });

            expect(result).toEqual({ valid: true });
        });

        it("rejects empty resourceRoles", () => {
            const result = validatePermissions({
                type: "fine-grained",
                resourceRoles: {}
            });

            expect(result).toEqual({
                valid: false,
                code: "invalid_permissions",
                message: "Fine-grained permissions require at least one resource with a role assigned."
            });
        });

        it("rejects cliEnabled for admin role on resource", () => {
            const result = validatePermissions({
                type: "fine-grained",
                resourceRoles: {
                    "docs.example.com": { role: "admin", cliEnabled: true }
                }
            });

            expect(result).toEqual({
                valid: false,
                code: "invalid_permissions",
                message: 'CLI access for resource "docs.example.com" can only be enabled for the editor role.'
            });
        });

        it("rejects cliEnabled for viewer role on resource", () => {
            const result = validatePermissions({
                type: "fine-grained",
                resourceRoles: {
                    "docs.example.com": { role: "viewer", cliEnabled: true }
                }
            });

            expect(result).toEqual({
                valid: false,
                code: "invalid_permissions",
                message: 'CLI access for resource "docs.example.com" can only be enabled for the editor role.'
            });
        });

        it("validates all resources and catches error in any", () => {
            const result = validatePermissions({
                type: "fine-grained",
                resourceRoles: {
                    "docs.example.com": { role: "editor", cliEnabled: false },
                    "api.example.com": { role: "viewer", cliEnabled: true }
                }
            });

            expect(result).toEqual({
                valid: false,
                code: "invalid_permissions",
                message: 'CLI access for resource "api.example.com" can only be enabled for the editor role.'
            });
        });
    });
});
