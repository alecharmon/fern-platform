import type { GetOrganizations200ResponseOneOfInner } from "auth0";
import { type Auth0Organization, Auth0OrgID, Auth0OrgName } from "./types";

export function convertToAuth0Organization(organization: GetOrganizations200ResponseOneOfInner): Auth0Organization {
    const converted: Auth0Organization = {
        ...organization,
        id: Auth0OrgID(organization.id),
        name: Auth0OrgName(organization.name)
    } as unknown as Auth0Organization;

    return converted;
}
