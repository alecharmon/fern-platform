import { Turbopuffer } from "@turbopuffer/turbopuffer";

import { NavigationNodePage } from "@fern-api/fdr-sdk/navigation";
import {
  LoadDocsWithUrlPayload,
  loadDocsWithUrl,
} from "@fern-docs/search-utils";

import { createTurbopufferRecords } from "../records/create-turbopuffer-records";
import { vectorizeTurbopufferRecords } from "../records/vectorize-turbopuffer-records";
import { FernTurbopufferAttributeSchema } from "../types";

const UPSERT_BATCH_SIZE = 2000;

interface TurbopufferIndexerTaskOptions {
  apiKey: string;
  namespace: string;
  payload: LoadDocsWithUrlPayload;

  /**
   * Whether the page is authed or not.
   */
  authed?: (node: NavigationNodePage) => boolean;

  /**
   * The vectorizer to use.
   */
  vectorizer: (chunk: string[]) => Promise<number[][]>;

  /**
   * Text splitter to use.
   */
  splitText?: (text: string) => Promise<string[]>;

  /**
   * Whether to delete the existing records before upserting.
   */
  deleteExisting?: boolean;
}

export async function turbopufferUpsertTask({
  apiKey,
  namespace,
  payload,
  authed,
  vectorizer,
  splitText = (text) => Promise.resolve([text]),
  deleteExisting = true,
}: TurbopufferIndexerTaskOptions): Promise<number> {
  const tpuf = new Turbopuffer({
    apiKey,
    baseUrl: "https://gcp-us-east4.turbopuffer.com",
  });
  const ns = tpuf.namespace(namespace);

  const { root, pages, apis, domain } = await loadDocsWithUrl(payload);

  const unvectorizedRecords = await createTurbopufferRecords({
    root,
    domain,
    pages,
    apis,
    authed,
    splitText,
  });

  console.log("Created turbopuffer records for domain: ", domain);

  const records = await vectorizeTurbopufferRecords(
    unvectorizedRecords,
    vectorizer
  );

  console.log("Vectorized turbopuffer records for domain: ", domain);

  if (deleteExisting) {
    await ns.deleteAll();
  }

  console.log("Deleted existing records for domain: ", domain);

  try {
    // Upsert records in batches of UPSERT_BATCH_SIZE to avoid exceeding 256MB payload size limit
    for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
      const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
      await ns.upsert({
        vectors: batch,
        distance_metric: "cosine_distance",
        schema: FernTurbopufferAttributeSchema,
      });
      console.log(
        `Upserted batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}: ${batch.length} records`
      );
    }
  } catch (error) {
    console.error(
      "Error upserting records to turbopuffer ",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }

  console.log("Finished upserting records to turbopuffer for domain: ", domain);
  return records.length;
}
