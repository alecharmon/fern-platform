import type { GetMembers200ResponseOneOfInner } from "auth0";
import { getAuth0ManagementClient } from "./auth0";

const FERN_EMAIL_DOMAIN = "@buildwithfern.com";

/**
 * Get current seat usage for an org by counting Auth0 org members,
 * excluding anyone with a @buildwithfern.com email.
 */
export async function getSeatsUsage(orgId: string): Promise<number> {
    const members = await getAllOrgMembers(orgId);
    return members.filter((m) => !m.email?.endsWith(FERN_EMAIL_DOMAIN)).length;
}

async function getAllOrgMembers(orgId: string): Promise<GetMembers200ResponseOneOfInner[]> {
    const auth0 = getAuth0ManagementClient();
    const members: GetMembers200ResponseOneOfInner[] = [];

    let page = 0;
    const perPage = 100;

    while (true) {
        const { data } = await auth0.organizations.getMembers({
            id: orgId,
            page,
            per_page: perPage,
            fields: "user_id,email"
        });
        members.push(...data);
        page++;
        if (data.length < perPage) {
            break;
        }
    }

    return members;
}
