import { NextRequest, NextResponse } from "next/server";

import { createOpenAI } from "@ai-sdk/openai";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
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

import { JobManager, createJobResponse } from "@/jobs";

export const maxDuration = 800; // 13 minutes

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isLocal() || isSelfHosted()) {
    return NextResponse.json(
      "turbopuffer is not accessible in local preview mode",
      { status: 400 }
    );
  }

  const host = req.nextUrl.host;
  const domain = getDocsDomainEdge(req);
  const deleteExisting =
    req.nextUrl.searchParams.get("deleteExisting") === "true";

  const fernDocsIndexName = getFernDocsIndexName();
  const namespace = getTurbopufferNamespace(domain, fernDocsIndexName);

  const job_id = await JobManager.createJob(domain);

  JobManager.executeJob(domain, async () => {
    const openai = createOpenAI({ apiKey: openaiApiKey() });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    try {
      const loader = await createCachedDocsLoader(host, domain);
      const metadata = await loader.getMetadata();
      if (metadata == null) {
        throw new Error("Documentation not found");
      }
      if (metadata.isPreview) {
        return {
          message: "Preview sites are not indexed",
          added: 0,
          domain,
          namespace,
        };
      }

      const [authEdgeConfig, edgeFlags] = await Promise.all([
        getAuthEdgeConfig(domain),
        getEdgeFlags(domain),
      ]);

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

      return {
        added: numInserted,
        domain,
        namespace,
        message: "Turbopuffer reindex completed successfully",
      };
    } catch (error) {
      console.error(`[turbopuffer-start] ${JSON.stringify(error)}`);

      postToSlack(
        "#search-notifs",
        `:rotating_light: [TURBOPUFFER-START] Failed to reindex for ${domain} with the following error: ${String(error)}`,
        "turbopuffer-reindex-start"
      );

      throw error;
    }
  }).catch((error) => {
    console.error(`Job ${job_id} execution failed:`, error);
  });

  return createJobResponse("Turbopuffer reindex job started", job_id);
}
