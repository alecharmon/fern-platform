import { NextRequest, NextResponse } from "next/server";

import { createOpenAI } from "@ai-sdk/openai";
import { kv } from "@vercel/kv";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import {
  fdrEnvironment,
  fernToken_admin,
  getFaiOrigin,
  openaiApiKey,
  turbopufferApiKey,
} from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { postToSlack } from "@fern-api/docs-server/slack";
import { Gate, withBasicTokenAnonymous } from "@fern-api/docs-server/withRbac";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { slugToHref, withoutStaging } from "@fern-api/docs-utils";
import { FernAIClient } from "@fern-api/fai-sdk";
import { getAuthEdgeConfig, getEdgeFlags } from "@fern-docs/edge-config";
import {
  getFernDocsIndexName,
  getTurbopufferNamespace,
  getTurbopufferVectorizer,
  turbopufferUpsertTask,
} from "@fern-docs/search-ask-fern";

import { getFaiClient } from "@/getFaiClient";

export const maxDuration = 800; // 13 minutes

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isLocal() || isSelfHosted()) {
    return NextResponse.json(
      "turbopuffer is not accessible in local preview mode",
      { status: 400 }
    );
  }

  const openai = createOpenAI({ apiKey: openaiApiKey() });
  const embeddingModel = openai.embedding("text-embedding-3-large");

  const host = req.nextUrl.host;
  const domain = getDocsDomainEdge(req);
  const deleteExisting =
    req.nextUrl.searchParams.get("deleteExisting") === "true";

  const fernDocsIndexName = getFernDocsIndexName();
  const namespace = getTurbopufferNamespace(domain, fernDocsIndexName);

  try {
    const loader = await createCachedDocsLoader(host, domain);
    const metadata = await loader.getMetadata();
    if (metadata == null) {
      return NextResponse.json("Not found", { status: 404 });
    }
    if (metadata.isPreview) {
      return NextResponse.json(
        {
          added: 0,
          updated: 0,
          deleted: 0,
          unindexable: 0,
        },
        { status: 200 }
      );
    }

    const [authEdgeConfig, edgeFlags] = await Promise.all([
      getAuthEdgeConfig(domain),
      getEdgeFlags(domain),
    ]);

    const isAskAiEnabled = (
      await getFaiClient({
        token: process.env.FERN_TOKEN ?? "",
      }).settings.getSettings({ domain })
    ).ask_ai_enabled;

    const askAiProcessing = await kv.hget(domain, "tpuf_job").then((job) => {
      return (
        job &&
        typeof job === "object" &&
        "status" in job &&
        job.status === "in_progress"
      );
    });

    if (!isAskAiEnabled && !askAiProcessing) {
      return NextResponse.json("Ask Fern is not enabled for this domain", {
        status: 404,
      });
    }

    const start = Date.now();
    const numInserted = await turbopufferUpsertTask({
      apiKey: turbopufferApiKey(),
      namespace,
      payload: {
        environment: fdrEnvironment(),
        fernToken: fernToken_admin(),
        domain: withoutStaging(domain),
        ...edgeFlags,
      },
      vectorizer: getTurbopufferVectorizer(embeddingModel),
      authed: (node) => {
        if (authEdgeConfig == null) {
          return false;
        }
        return (
          withBasicTokenAnonymous(authEdgeConfig, slugToHref(node.slug)) ===
          Gate.DENY
        );
      },
      deleteExisting,
    });
    const faiClient = new FernAIClient({
      baseUrl: getFaiOrigin(),
    });

    const syncResponse = await faiClient.index.syncIndexToQueryIndex(domain, {
      index_name: fernDocsIndexName,
    });

    const pollJobStatus = async (jobId: string): Promise<void> => {
      while (true) {
        const statusResponse = await faiClient.index.getJobStatus(jobId);
        const { status, success, error } = statusResponse;

        if (status === "completed") {
          if (success === false) {
            throw new Error(`Sync job failed: ${error || "Unknown error"}`);
          }
          break;
        } else if (status === "failed") {
          throw new Error(`Sync job failed: ${error || "Unknown error"}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 15000));
      }
    };

    await pollJobStatus(syncResponse.job_id);

    const end = Date.now();

    track("turbopuffer_reindex", {
      embeddingModel: embeddingModel.modelId,
      durationMs: end - start,
      domain,
      namespace,
      added: numInserted,
      job_id: syncResponse.job_id,
    });

    await kv.hset(domain, {
      tpuf_job: {
        status: "completed",
      },
    });

    return NextResponse.json(
      {
        added: numInserted,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[turbopuffer] ${JSON.stringify(error)}`);

    track("turbopuffer_reindex_error", {
      embeddingModel: embeddingModel.modelId,
      domain,
      namespace,
      error: String(error),
    });

    postToSlack(
      "#search-notifs",
      `:rotating_light: [TURBOPUFFER] Failed to reindex ${domain} with the following error: ${String(error)}`,
      "turbopuffer-reindex"
    );

    await kv.hset(domain, {
      tpuf_job: {
        status: "failed",
      },
    });

    return NextResponse.json(`Internal server error, error: ${String(error)}`, {
      status: 500,
    });
  }
}
