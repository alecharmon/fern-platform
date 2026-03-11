import type { ActivityLogEntry, Duration } from "@fern-platform/activity-log";
import { insertActivityLog } from "@fern-platform/activity-log";

interface InsertActivityRequestBody {
    org_id: string;
    site: string;
    entry: ActivityLogEntry;
    ttl?: Duration;
}

export default async function handleInsertActivity(body: InsertActivityRequestBody) {
    const result = await insertActivityLog(body.org_id, body.site, body.entry, {
        ttl: body.ttl
    });

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return result.value;
}
