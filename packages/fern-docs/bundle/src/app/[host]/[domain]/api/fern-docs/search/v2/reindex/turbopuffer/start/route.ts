import { NextRequest, NextResponse } from "next/server";

import { createOpenAI } from "@ai-sdk/openai";

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
          job_id: null,
          message: "Preview sites are not indexed",
        },
        { status: 200 }
      );
    }

    const [authEdgeConfig, edgeFlags] = await Promise.all([
      getAuthEdgeConfig(domain),
      getEdgeFlags(domain),
    ]);

    // Run the turbopuffer upsert task
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

    track("turbopuffer_reindex_started", {
      embeddingModel: embeddingModel.modelId,
      domain,
      namespace,
      added: numInserted,
    });

    return NextResponse.json(
      {
        job_id: syncResponse.job_id,
        added: numInserted,
        message: "Reindex started successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[turbopuffer-start] ${JSON.stringify(error)}`);

    track("turbopuffer_reindex_start_error", {
      embeddingModel: embeddingModel.modelId,
      domain,
      namespace,
      error: String(error),
    });

    postToSlack(
      "#search-notifs",
      `:rotating_light: [TURBOPUFFER-START] Failed to start reindex for ${domain} with the following error: ${String(error)}`,
      "turbopuffer-reindex-start"
    );

    return NextResponse.json(`Internal server error, error: ${String(error)}`, {
      status: 500,
    });
  }
}
