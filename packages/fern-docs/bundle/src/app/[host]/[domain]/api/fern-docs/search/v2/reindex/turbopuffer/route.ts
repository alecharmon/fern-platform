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
import { FernFaiClient } from "@fern-api/fai-sdk";
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

    if (!edgeFlags.isAskAiEnabled) {
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
    const faiClient = new FernFaiClient({
      baseUrl: getFaiOrigin(),
      token: fernToken_admin(),
    });

    await faiClient.index.syncToQueryIndex(domain, {
      index_name: fernDocsIndexName,
    });

    const end = Date.now();

    track("turbopuffer_reindex", {
      embeddingModel: embeddingModel.modelId,
      durationMs: end - start,
      domain,
      namespace,
      added: numInserted,
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

    return NextResponse.json(`Internal server error, error: ${String(error)}`, {
      status: 500,
    });
  }
}
