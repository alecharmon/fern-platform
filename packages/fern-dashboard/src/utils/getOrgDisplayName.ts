import type { Auth0Organization } from "@/app/services/auth0/types";

export function getOrgDisplayName(org: Auth0Organization | undefined) {
    return org?.display_name ?? org?.name;
}
