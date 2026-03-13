import type { ActivityLogType } from "@fern-platform/activity-log";
import { insertCreditUsage } from "@fern-platform/activity-log";

import { resolveToAuth0OrgId } from "../_utils/resolveOrgId";

interface InsertCreditUsageRequestBody {
    org_id: string;
    site: string;
    type: ActivityLogType;
    credits_used: number;
    event_id: string;
}

export default async function handleInsertCreditUsage(body: InsertCreditUsageRequestBody) {
    const auth0OrgId = await resolveToAuth0OrgId(body.org_id);
    const result = await insertCreditUsage(auth0OrgId, body.site, body.type, body.credits_used, body.event_id);

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return result.value;
}
