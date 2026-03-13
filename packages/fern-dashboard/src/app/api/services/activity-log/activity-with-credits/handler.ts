import type { ActivityLogEntry, Duration } from "@fern-platform/activity-log";
import { logActivityWithCredits } from "@fern-platform/activity-log";

import { resolveToAuth0OrgId } from "../_utils/resolveOrgId";

interface LogActivityWithCreditsRequestBody {
    org_id: string;
    site: string;
    entry: ActivityLogEntry;
    ttl?: Duration;
}

export default async function handleLogActivityWithCredits(body: LogActivityWithCreditsRequestBody) {
    const auth0OrgId = await resolveToAuth0OrgId(body.org_id);
    const result = await logActivityWithCredits(auth0OrgId, body.site, body.entry, {
        ttl: body.ttl
    });

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    return result.value;
}
