"use server";

import type { ActivityLog, ActivityLogType } from "@fern-platform/activity-log";
import { getActivityLogs, getCreditUsage, sumCreditUsage } from "@fern-platform/activity-log";
import { type BillingPeriod, getBillingPeriod } from "@fern-platform/billing";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getEntitlementsChecker } from "@/app/services/entitlements/checker";

export interface CreditUsageRow {
    id: string;
    description: string;
    docsSite: string;
    type: ActivityLogType;
    date: string;
    creditsUsed: number;
    prUrls?: string[];
}

export interface AiCreditUsageData {
    billingPeriod: BillingPeriod;
    totalUsed: number;
    availableCredits: number;
    rows: CreditUsageRow[];
}

export async function getAiCreditUsageAction(
    orgName: Auth0OrgName
): Promise<{ data: AiCreditUsageData } | { error: string }> {
    try {
        const { accessToken } = await getCurrentSessionOrThrow();
        await assertUserHasOrganizationAccess(accessToken, orgName);

        const orgId = await getOrgIdFromName(orgName);

        const periodResult = await getBillingPeriod(orgId);
        if (periodResult.isErr()) {
            return { error: periodResult.error.message };
        }
        const billingPeriod = periodResult.value;

        const [sumResult, activityResult, creditResult] = await Promise.all([
            sumCreditUsage(orgId, billingPeriod.since, billingPeriod.until),
            getActivityLogs(orgId, { limit: 1000 }),
            getCreditUsage(orgId, { limit: 1000 })
        ]);

        if (sumResult.isErr()) {
            return { error: sumResult.error.message };
        }

        const totalUsed = sumResult.value;

        // Build a map of event_id -> activity log for metadata lookup
        const activityMap = new Map<string, ActivityLog>();
        if (activityResult.isOk()) {
            for (const log of activityResult.value) {
                activityMap.set(log.id, log);
            }
        }

        // Build rows from credit usage entries, enriched with activity metadata
        const credits = creditResult.isOk() ? creditResult.value : [];
        const rows: CreditUsageRow[] = credits.map((credit) => {
            const activity = credit.event_id ? activityMap.get(credit.event_id) : undefined;
            const metadata = activity?.metadata as Record<string, unknown> | undefined;

            let description = "";
            if (credit.type === "ask_fern") {
                description = (metadata?.question as string) ?? "Ask Fern query";
            } else if (credit.type === "fern_writer") {
                description = (metadata?.message_text as string) ?? "Fern Writer session";
            }

            return {
                id: credit.id,
                description,
                docsSite: credit.site,
                type: credit.type,
                date: credit.created_at,
                creditsUsed: credit.credits_used,
                prUrls: credit.type === "fern_writer" ? (metadata?.pr_urls as string[] | undefined) : undefined
            };
        });

        // Get the credit limit from entitlements
        const checker = getEntitlementsChecker();
        const aiCreditsResult = await checker.check(orgId, "ai_credits");
        const creditLimit =
            aiCreditsResult.entitled && aiCreditsResult.type === "metered" ? aiCreditsResult.allowance : 250;
        const availableCredits = Math.max(0, creditLimit - totalUsed);

        return {
            data: {
                billingPeriod,
                totalUsed,
                availableCredits,
                rows
            }
        };
    } catch (error: unknown) {
        console.error("[getAiCreditUsageAction] Unexpected error:", error);
        return { error: error instanceof Error ? error.message : "Failed to get AI credit usage" };
    }
}
