"use server";

import { revalidateTag } from "next/cache";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getFaiClient } from "../services/fai/getFaiClient";

export async function toggleAskAi({ domain, orgName }: { domain: string; orgName: string }): Promise<{
    success: boolean;
    job_id?: string;
    ask_ai_enabled: boolean;
}> {
    await getCurrentSessionOrThrow();
    const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
    const response = await faiClient.settings.toggleAskAi({
        domain,
        org_name: orgName
    });

    // Revalidate cached Ask AI status after toggling
    revalidateTag(`ask-ai:${domain}`, "default");

    return {
        success: response.success || false,
        job_id: response.job_id,
        ask_ai_enabled: response.ask_ai_enabled || false
    };
}

export async function isAskAiEnabled({
    domain
}: {
    domain: string;
}): Promise<{ ask_ai_enabled: boolean; job_id?: string }> {
    await getCurrentSessionOrThrow();
    const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
    const settings = await faiClient.settings.getDocsSettings({ domain });
    return {
        ask_ai_enabled: settings.ask_ai_enabled || false,
        job_id: settings.job_id
    };
}

export async function reindexAskAi({ domain, orgName }: { domain: string; orgName: string }): Promise<{
    success: boolean;
    job_id?: string;
    ask_ai_enabled: boolean;
}> {
    await getCurrentSessionOrThrow();
    const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
    const response = await faiClient.settings.reindexAskAi({
        domain,
        org_name: orgName
    });
    // Revalidate cached Ask AI status after reindexing
    revalidateTag(`ask-ai:${domain}`, "default");

    return {
        success: response.success || false,
        job_id: response.job_id,
        ask_ai_enabled: response.ask_ai_enabled || false
    };
}

export async function getToggleStatus({
    domain
}: {
    domain: string;
}): Promise<{ status: string; lastReindexTime?: string }> {
    await getCurrentSessionOrThrow();
    const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
    const response = await faiClient.settings.getToggleStatus({ domain });
    return {
        status: response.status || "failed",
        lastReindexTime: response.last_reindex_time ?? undefined
    };
}

export async function getLastReindexTime({ domain }: { domain: string }): Promise<string | undefined> {
    await getCurrentSessionOrThrow();
    const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
    try {
        const response = await faiClient.settings.getToggleStatus({ domain });
        return response.last_reindex_time ?? undefined;
    } catch {
        return undefined;
    }
}
