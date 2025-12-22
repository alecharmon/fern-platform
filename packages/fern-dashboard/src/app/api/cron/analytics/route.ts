/**
 * Analytics Cron API Route
 *
 * This endpoint is triggered by Vercel Cron to run analytics collection
 * for all organizations and docs sites on a daily schedule.
 *
 * @see https://vercel.com/docs/cron-jobs
 */
import { type NextRequest, NextResponse } from "next/server";

import { runAnalyticsCronForAllPeriods } from "@/app/services/analytics/cron/run";
import type { DateRangePeriod } from "@/app/services/analytics/cron/types";

/**
 * GET /api/cron/analytics
 *
 * Runs the analytics cron job for all organizations and docs sites.
 * This endpoint is called by Vercel Cron on a schedule defined in vercel.json.
 *
 * The endpoint is protected by Vercel's cron secret to prevent unauthorized access.
 *
 * Note: Uses GET instead of POST because Vercel Cron only sends GET requests
 */
export async function GET(request: NextRequest) {
    // Verify the request is from Vercel Cron
    // Vercel automatically sends Authorization header with CRON_SECRET when configured
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error("[analytics-cron] CRON_SECRET not configured");
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        console.error("[analytics-cron] Unauthorized request - invalid or missing authorization header");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[analytics-cron] Starting analytics cron job");

    try {
        // Run analytics cron for all domains with periods 7, 14, and 30 days
        // Processes domains in parallel (10 concurrent), periods sequentially per domain
        const periods: DateRangePeriod[] = [7, 14, 30];

        console.log(`[analytics-cron] Running analytics cron for periods: ${periods.join(", ")} days`);

        const resultsByPeriod = await runAnalyticsCronForAllPeriods({ periods });

        // Aggregate results
        const allResults = Array.from(resultsByPeriod.values());
        const totalDuration = allResults.reduce(
            (sum, r) => sum + (new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()),
            0
        );

        console.log("[analytics-cron] Analytics cron job completed successfully for all periods", {
            periods: periods.join(", "),
            totalDuration
        });

        return NextResponse.json(
            {
                success: true,
                results: allResults.map((r) => ({
                    period: r.period,
                    totalSites: r.totalSites,
                    totalSuccesses: r.totalSuccesses,
                    totalErrors: r.totalErrors,
                    startedAt: r.startedAt,
                    completedAt: r.completedAt,
                    duration: new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()
                })),
                totalDuration
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("[analytics-cron] Error running analytics cron job:", error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
