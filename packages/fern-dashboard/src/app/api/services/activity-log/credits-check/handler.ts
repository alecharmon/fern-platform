import { checkCreditAllowance } from "@fern-platform/activity-log";
import { createEntitlementsChecker } from "@fern-platform/entitlements";

import { resolveToAuth0OrgId } from "../_utils/resolveOrgId";

interface CreditsCheckRequestBody {
    org_id: string;
}

const checker = createEntitlementsChecker();

export default async function handleCreditsCheck(body: CreditsCheckRequestBody) {
    const auth0OrgId = await resolveToAuth0OrgId(body.org_id);
    const result = await checkCreditAllowance(auth0OrgId, (orgId, key) => checker.check(orgId, key));

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return result.value;
}
