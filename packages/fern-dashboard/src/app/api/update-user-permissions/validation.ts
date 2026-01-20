import { z } from "zod";

import { orgNameValidator, userIdValidator } from "../utils/validators";

const userRoleValidator = z.enum(["admin", "editor", "viewer"]);
const resourceRoleValidator = z.enum(["admin", "editor", "viewer"]);

const orgLevelPermissions = z.object({
    type: z.literal("org"),
    role: userRoleValidator,
    cliEnabled: z.boolean()
});

const resourceRoleEntry = z.object({
    role: resourceRoleValidator,
    cliEnabled: z.boolean()
});

const fineGrainedPermissions = z.object({
    type: z.literal("fine-grained"),
    resourceRoles: z.record(z.string(), resourceRoleEntry)
});

export const UpdateUserPermissionsRequest = z.object({
    orgName: orgNameValidator,
    userId: userIdValidator,
    permissions: z.discriminatedUnion("type", [orgLevelPermissions, fineGrainedPermissions])
});

export type UpdateUserPermissionsRequest = z.infer<typeof UpdateUserPermissionsRequest>;
export type OrgLevelPermissions = z.infer<typeof orgLevelPermissions>;
export type FineGrainedPermissions = z.infer<typeof fineGrainedPermissions>;
export type ResourceRoleEntry = z.infer<typeof resourceRoleEntry>;

export type ValidationResult =
    | { valid: true }
    | { valid: false; code: "validation_error" | "invalid_permissions"; message: string };

/**
 * Validates the business rules for permissions:
 * 1. For org-level: cliEnabled is only valid when role is "editor"
 * 2. For fine-grained: must have at least one resource with a non-none role
 */
export function validatePermissions(permissions: UpdateUserPermissionsRequest["permissions"]): ValidationResult {
    if (permissions.type === "org") {
        return validateOrgLevelPermissions(permissions);
    } else {
        return validateFineGrainedPermissions(permissions);
    }
}

function validateOrgLevelPermissions(permissions: OrgLevelPermissions): ValidationResult {
    // cliEnabled is only valid for editor role (admins have implicit CLI access)
    if (permissions.cliEnabled && permissions.role !== "editor") {
        return {
            valid: false,
            code: "invalid_permissions",
            message: "CLI access can only be enabled for the editor role. Admins have implicit CLI access."
        };
    }

    return { valid: true };
}

function validateFineGrainedPermissions(permissions: FineGrainedPermissions): ValidationResult {
    const resourceEntries = Object.entries(permissions.resourceRoles);

    // Must have at least one resource defined
    if (resourceEntries.length === 0) {
        return {
            valid: false,
            code: "invalid_permissions",
            message: "Fine-grained permissions require at least one resource with a role assigned."
        };
    }

    // At least one resource must have a non-none role
    const hasAtLeastOneRole = resourceEntries.some(([_, entry]) => entry.role !== undefined);

    if (!hasAtLeastOneRole) {
        return {
            valid: false,
            code: "invalid_permissions",
            message: "Fine-grained permissions require at least one resource with a role assigned."
        };
    }

    // Validate CLI access rules for each resource
    for (const [resourceId, entry] of resourceEntries) {
        if (entry.cliEnabled && entry.role !== "editor") {
            return {
                valid: false,
                code: "invalid_permissions",
                message: `CLI access for resource "${resourceId}" can only be enabled for the editor role.`
            };
        }
    }

    return { valid: true };
}
