import type { ActivityLogType } from "@fern-platform/activity-log";
import { sumCreditUsage } from "@fern-platform/activity-log";

interface SumCreditUsageRequestBody {
    org_id: string;
    since: string;
    until: string;
    site?: string;
    type?: ActivityLogType;
}

export default async function handleSumCreditUsage(body: SumCreditUsageRequestBody) {
    const result = await sumCreditUsage(body.org_id, body.since, body.until, {
        site: body.site,
        type: body.type
    });

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return { total: result.value };
}
