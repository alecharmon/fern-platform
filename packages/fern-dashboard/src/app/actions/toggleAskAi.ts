"use server";

import { revalidateTag } from "next/cache";

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

export async function getToggleStatus({
  domain,
}: {
  domain: string;
}): Promise<string> {
  const faiClient = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
  const response = await faiClient.settings.getToggleStatus({ domain });
  return response.status || "unknown";
}
