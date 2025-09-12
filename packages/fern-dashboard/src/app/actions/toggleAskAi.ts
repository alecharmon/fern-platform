"use server";

import { revalidateTag } from "next/cache";

import { kv } from "@vercel/kv";

import { getFaiClient } from "../services/fai/getFaiClient";

export async function toggleAskAi({
  domain,
  orgName,
}: {
  domain: string;
  orgName: string;
}): Promise<{
  success: boolean;
  job_id?: string;
  ask_ai_enabled: boolean;
}> {
  const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
  const response = await faiClient.settings.toggleAskAi({
    domain,
    org_name: orgName,
  });

  if (response.success) {
    revalidateTag(`${domain}_askAiEnabled`);
    try {
      await kv.hdel(domain, "askAiEnabled");
    } catch (error) {
      console.warn("Failed to clear askAiEnabled cache:", error);
    }
  }

  return {
    success: response.success || false,
    job_id: response.job_id,
    ask_ai_enabled: response.ask_ai_enabled || false,
  };
}

export async function isAskAiEnabled({
  domain,
}: {
  domain: string;
}): Promise<{ ask_ai_enabled: boolean; job_id?: string }> {
  const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
  const settings = await faiClient.settings.getSettings({ domain });
  return {
    ask_ai_enabled: settings.ask_ai_enabled || false,
    job_id: settings.job_id,
  };
}

export async function reindexAskAi({
  domain,
  orgName,
}: {
  domain: string;
  orgName: string;
}): Promise<{
  success: boolean;
  job_id?: string;
  ask_ai_enabled: boolean;
}> {
  const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
  const response = await faiClient.settings.reindexAskAi({
    domain,
    org_name: orgName,
  });
  return {
    success: response.success || false,
    job_id: response.job_id,
    ask_ai_enabled: response.ask_ai_enabled || false,
  };
}

export async function getToggleStatus({ domain }: { domain: string }): Promise<{
  status: string;
  completed: boolean;
  failed: boolean;
  ask_ai_enabled: boolean;
  job_id?: string;
  last_reindex_time?: string;
}> {
  const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
  const response = await faiClient.settings.getToggleStatus({ domain });
  return {
    status: response.status || "unknown",
    completed: response.completed || false,
    failed: response.failed || false,
    ask_ai_enabled: response.ask_ai_enabled || false,
    job_id: response.job_id,
    last_reindex_time: response.last_reindex_time,
  };
}
