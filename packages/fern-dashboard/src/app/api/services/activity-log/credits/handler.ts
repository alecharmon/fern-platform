import type { ActivityLogType } from "@fern-platform/activity-log";
import { insertCreditUsage } from "@fern-platform/activity-log";

interface InsertCreditUsageRequestBody {
    org_id: string;
    site: string;
    type: ActivityLogType;
    credits_used: number;
    event_id: string;
}

export default async function handleInsertCreditUsage(body: InsertCreditUsageRequestBody) {
    const result = await insertCreditUsage(body.org_id, body.site, body.type, body.credits_used, body.event_id);

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return result.value;
}
