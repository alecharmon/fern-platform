import type { ActivityLogType } from "@fern-platform/activity-log";
import { sumCreditUsage } from "@fern-platform/activity-log";

import { resolveToAuth0OrgId } from "../_utils/resolveOrgId";

interface SumCreditUsageRequestBody {
    org_id: string;
    since: string;
    until: string;
    site?: string;
    type?: ActivityLogType;
}

export default async function handleSumCreditUsage(body: SumCreditUsageRequestBody) {
    const auth0OrgId = await resolveToAuth0OrgId(body.org_id);
    const result = await sumCreditUsage(auth0OrgId, body.since, body.until, {
        site: body.site,
        type: body.type
    });

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return { total: result.value };
}
