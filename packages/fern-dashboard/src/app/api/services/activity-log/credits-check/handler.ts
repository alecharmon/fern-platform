import { checkCreditAllowance } from "@fern-platform/activity-log";
import { createEntitlementsChecker } from "@fern-platform/entitlements";

interface CreditsCheckRequestBody {
    org_id: string;
}

const checker = createEntitlementsChecker();

export default async function handleCreditsCheck(body: CreditsCheckRequestBody) {
    const result = await checkCreditAllowance(body.org_id, (orgId, key) => checker.check(orgId, key));

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return result.value;
}
