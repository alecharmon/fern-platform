import { useParams } from "next/navigation";

import { Auth0OrgName } from "@/app/services/auth0/types";

export function useOrgNameFromPathname() {
    const params = useParams();
    return params.orgName as Auth0OrgName;
}
