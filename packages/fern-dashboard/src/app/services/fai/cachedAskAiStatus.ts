"use cache";

import { cacheLife, cacheTag } from "next/cache";

import { getFaiClient } from "./getFaiClient";

/**
 * Cached version of isAskAiEnabled.
 * Ask AI status changes infrequently, so we cache for 5 minutes per domain.
 */
export async function getCachedAskAiStatus(domain: string): Promise<{ ask_ai_enabled: boolean; job_id?: string }> {
    cacheLife("minutes");
    cacheTag(`ask-ai:${domain}`);

    const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
    const settings = await faiClient.settings.getDocsSettings({ domain });
    return {
        ask_ai_enabled: settings.ask_ai_enabled || false,
        job_id: settings.job_id
    };
}
