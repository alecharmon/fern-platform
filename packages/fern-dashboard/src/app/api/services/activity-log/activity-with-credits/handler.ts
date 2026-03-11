import type { ActivityLogEntry, Duration } from "@fern-platform/activity-log";
import { logActivityWithCredits } from "@fern-platform/activity-log";

interface LogActivityWithCreditsRequestBody {
    org_id: string;
    site: string;
    entry: ActivityLogEntry;
    ttl?: Duration;
}

export default async function handleLogActivityWithCredits(body: LogActivityWithCreditsRequestBody) {
    const result = await logActivityWithCredits(body.org_id, body.site, body.entry, {
        ttl: body.ttl
    });

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return result.value;
}
