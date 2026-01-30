import { addRoles, getRoles } from "@fern-api/user-permissions";
import { createIsFernEmployee, getOrgIdFromName, getOrgMembers } from "@/app/services/auth0/management";
import { Auth0OrgName, type Auth0UserID } from "@/app/services/auth0/types";

export interface AutoAssignAdminRoleParams {
    userId: Auth0UserID;
    orgName: Auth0OrgName;
}

export type AutoAssignAdminRoleResult =
    | { status: "assigned" }
    | { status: "skipped"; reason: "user_has_roles" | "not_only_member" | "user_is_fern_employee" }
    | { status: "error"; error: unknown };

export async function tryAutoAssignAdminRole({
    userId,
    orgName
}: AutoAssignAdminRoleParams): Promise<AutoAssignAdminRoleResult> {
    try {
        const isFernEmployee = await createIsFernEmployee();
        if (isFernEmployee(userId)) {
            console.info("Skipping auto-assign admin for Fern employee", {
                userId,
                orgName
            });
            return { status: "skipped", reason: "user_is_fern_employee" };
        }

        const orgId = await getOrgIdFromName(Auth0OrgName(orgName));

        const userRoles = await getRoles({ userId, orgId });
        const hasNoRoles = !userRoles.data || userRoles.data.length === 0;

        if (!hasNoRoles) {
            return { status: "skipped", reason: "user_has_roles" };
        }

        const members = await getOrgMembers(Auth0OrgName(orgName), { includeFernEmployees: false });
        const isOnlyMember = members.length === 1 && members[0]?.user_id === userId;

        if (!isOnlyMember) {
            return { status: "skipped", reason: "not_only_member" };
        }

        console.info("Auto-assigning admin role to sole org member without roles", {
            userId,
            orgName,
            orgId
        });

        const addRoleResult = await addRoles({
            userId,
            orgId,
            roleNames: ["admin"]
        });

        if (addRoleResult.ok) {
            console.info("Successfully auto-assigned admin role", {
                userId,
                orgName
            });
            return { status: "assigned" };
        } else {
            console.error("Failed to auto-assign admin role", {
                userId,
                orgName,
                status: addRoleResult.status
            });
            return { status: "error", error: `Failed with status ${addRoleResult.status}` };
        }
    } catch (error) {
        console.error("Failed to check/assign auto-admin role", {
            userId,
            orgName,
            error
        });
        return { status: "error", error };
    }
}
