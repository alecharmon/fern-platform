import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export default async function getOrgMembers({ userId, orgName }: { userId: Auth0UserID; orgName: Auth0OrgName }) {
    const members = await auth0Management.getOrgMembers(orgName, {
        includeFernEmployees: await auth0Management.isFernEmployee(userId)
    });
    return members;
}
