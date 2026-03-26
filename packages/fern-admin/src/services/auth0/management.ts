import { isSuperUser } from "@fern-api/user-permissions";
import { type GetMembers200ResponseOneOfInner, ManagementClient } from "auth0";

import { Auth0OrgID, Auth0OrgName, Auth0UserID } from "./types";

export { isSuperUser };

export const FERN_ORG_NAME = Auth0OrgName("fern");

let AUTH0_MANAGEMENT_CLIENT: ManagementClient | undefined;

export function getAuth0ManagementClient() {
    if (AUTH0_MANAGEMENT_CLIENT == null) {
        const { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET } = process.env;

        if (AUTH0_DOMAIN == null) {
            throw new Error("AUTH0_DOMAIN is not defined");
        }
        if (AUTH0_CLIENT_ID == null) {
            throw new Error("AUTH0_CLIENT_ID is not defined");
        }
        if (AUTH0_CLIENT_SECRET == null) {
            throw new Error("AUTH0_CLIENT_SECRET is not defined");
        }

        AUTH0_MANAGEMENT_CLIENT = new ManagementClient({
            domain: AUTH0_DOMAIN,
            clientId: AUTH0_CLIENT_ID,
            clientSecret: AUTH0_CLIENT_SECRET,
            timeoutDuration: 60_000
        });
    }

    return AUTH0_MANAGEMENT_CLIENT;
}

export async function getOrgIdFromName(orgName: Auth0OrgName): Promise<Auth0OrgID> {
    const { data: organization } = await getAuth0ManagementClient().organizations.getByName({
        name: orgName
    });
    return Auth0OrgID(organization.id);
}

export async function createIsFernOrgMemberChecker(): Promise<(userId: Auth0UserID) => boolean> {
    const fernOrgId = await getOrgIdFromName(FERN_ORG_NAME);
    const members: GetMembers200ResponseOneOfInner[] = [];
    const auth0 = getAuth0ManagementClient();

    let pageIndex = 0;
    let pageData: GetMembers200ResponseOneOfInner[];
    do {
        const response = await auth0.organizations.getMembers({
            id: fernOrgId,
            page: pageIndex,
            per_page: 100,
            fields: "user_id"
        });
        pageData = response.data;
        members.push(...pageData);
        pageIndex++;
    } while (pageData.length > 0 && members.length < 1000);

    const fernMembers = new Set(members.map((member) => Auth0UserID(member.user_id)));
    return (userId: Auth0UserID) => fernMembers.has(Auth0UserID(userId));
}
