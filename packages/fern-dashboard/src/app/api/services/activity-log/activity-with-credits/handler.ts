import { getBillingEntitlementsChannel, postToSlackImmediate } from "@fern-api/docs-server/slack";
import type { ActivityLogEntry, Duration } from "@fern-platform/activity-log";
import { checkCreditAllowance, logActivityWithCredits } from "@fern-platform/activity-log";
import { createEntitlementsChecker } from "@fern-platform/entitlements";

import { resolveOrgName } from "@/app/services/auth0/resolve-org-name";
import { resolveToAuth0OrgId } from "../_utils/resolveOrgId";

interface LogActivityWithCreditsRequestBody {
    org_id: string;
    site: string;
    entry: ActivityLogEntry;
    ttl?: Duration;
}

const CREDIT_THRESHOLDS = [
    { ratio: 0.8, emoji: ":warning:", label: "80%" },
    { ratio: 1.0, emoji: ":rotating_light:", label: "100%" }
] as const;

/**
 * Send a Slack notification to the billing-entitlements channel (env-aware)
 * when an AI credit usage threshold is crossed.
 */
async function notifyCreditThreshold(
    auth0OrgId: string,
    emoji: string,
    label: string,
    used: number,
    limit: number
): Promise<void> {
    const orgName = await resolveOrgName(auth0OrgId);
    await postToSlackImmediate(
        getBillingEntitlementsChannel(),
        `${emoji} *AI credit usage at ${label}* | Org: *${orgName}* | Usage: *${used} / ${limit} credits*`,
        "billing"
    );
}

export default async function handleLogActivityWithCredits(body: LogActivityWithCreditsRequestBody) {
    const auth0OrgId = await resolveToAuth0OrgId(body.org_id);
    const result = await logActivityWithCredits(auth0OrgId, body.site, body.entry, {
        ttl: body.ttl
    });

    if (result.isErr()) {
        throw new Error(result.error.message);
    }

    // Fire-and-forget: check credit thresholds and send Slack notifications
    const creditsJustAdded = result.value.credit.credits_used;
    // Bypass the usage cache (staleTtlMs: 0) so the checker reads fresh totals
    // from the DB — the cache may not yet reflect the credits we just inserted.
    const checker = createEntitlementsChecker({ staleTtlMs: 0 });

    checkCreditAllowance(auth0OrgId, checker.check.bind(checker))
        .then((creditCheck) => {
            if (creditCheck.isErr()) {
                return;
            }

            const { used, limit } = creditCheck.value;
            if (limit === 0) {
                return;
            }

            const previousUsed = used - creditsJustAdded;

            for (const { ratio, emoji, label } of CREDIT_THRESHOLDS) {
                const thresholdValue = limit * ratio;
                if (previousUsed < thresholdValue && used >= thresholdValue) {
                    notifyCreditThreshold(auth0OrgId, emoji, label, used, limit).catch((err) =>
                        console.warn("[activity-with-credits] Slack notification failed:", err)
                    );
                }
            }
        })
        .catch((err) => console.warn("[activity-with-credits] Credit threshold check failed:", err));

    return result.value;
}
