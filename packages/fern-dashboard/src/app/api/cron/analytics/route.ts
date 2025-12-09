/**
 * Analytics Cron API Route
 *
 * This endpoint is triggered by Vercel Cron to run analytics collection
 * for all organizations and docs sites on a daily schedule.
 *
 * @see https://vercel.com/docs/cron-jobs
 */
import { type NextRequest, NextResponse } from "next/server";

import { runAnalyticsCron } from "@/app/services/analyticsCron/run";

/**
 * POST /api/cron/analytics
 *
 * Runs the analytics cron job for all organizations and docs sites.
 * This endpoint is called by Vercel Cron on a schedule defined in vercel.json.
 *
 * The endpoint is protected by Vercel's cron secret to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.ANALYTICS_CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.error("[analytics-cron] Unauthorized request - invalid or missing authorization header");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[analytics-cron] Starting analytics cron job");

    try {
        // Run analytics cron for all organizations with 7, 14, and 30-day periods
        // Using default concurrency limits (5 orgs, 10 sites)
        const periods = [7, 14, 30] as const;
        const results = [];

        for (const period of periods) {
            console.log(`[analytics-cron] Running for period: ${period} days`);
            const result = await runAnalyticsCron({ period });
            results.push(result);
            console.log(
                `[analytics-cron] Completed period ${period}: ${result.totalSuccesses} successes, ${result.totalErrors} errors`
            );
        }

        // Aggregate results
        const totalDuration = results.reduce(
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
                results: results.map((r) => ({
                    period: r.period,
                    totalOrgs: r.totalOrgs,
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
