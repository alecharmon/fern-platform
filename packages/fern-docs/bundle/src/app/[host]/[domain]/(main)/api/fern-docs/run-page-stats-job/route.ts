import { flushPosthog, track } from "@fern-api/docs-server";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getPageStatsJobConfig } from "@fern-docs/edge-config";
import { NextResponse } from "next/server";

export const maxDuration = 300; // 5 minutes timeout

export async function GET(): Promise<NextResponse> {
    if (isLocal() || isSelfHosted()) {
        return new NextResponse("run-page-stats-job is only available in production", { status: 400 });
    }

    try {
        const config = await getPageStatsJobConfig();

        if (!config) {
            return NextResponse.json(
                { success: false, error: "pageStatsJob config not found in edge config" },
                { status: 400 }
            );
        }

        if (!config.pageUrls || config.pageUrls.length === 0) {
            return NextResponse.json(
                { success: false, error: "pageUrls is missing or empty in pageStatsJob config" },
                { status: 400 }
            );
        }

        for (const url of config.pageUrls) {
            const fetchStart = performance.now();
            try {
                const res = await fetch(url, {
                    method: "GET",
                    signal: AbortSignal.timeout(60_000) // 60 second timeout per URL
                });

                const fetchEnd = performance.now();
                const durationMs = fetchEnd - fetchStart;

                track("page_stats_job_fetch_time", {
                    url,
                    durationMs,
                    status: res.status,
                    ok: res.ok
                });
            } catch (e) {
                const fetchEnd = performance.now();
                const durationMs = fetchEnd - fetchStart;
                const errorMessage = e instanceof Error ? e.message : String(e);

                track("page_stats_job_fetch_time", {
                    url,
                    durationMs,
                    status: null,
                    ok: false,
                    error: errorMessage
                });
            }
        }

        await flushPosthog();

        return NextResponse.json({ success: true });
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logger.error(`[run-page-stats-job] error: ${errorMessage}`);

        return NextResponse.json({ success: false }, { status: 500 });
    }
}
