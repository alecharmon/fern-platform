import * as auth0Management from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";

export default async function getOrgInvitations(orgName: Auth0OrgName) {
    const invitations = await auth0Management.getOrgInvitations(orgName);
    return invitations;
}
