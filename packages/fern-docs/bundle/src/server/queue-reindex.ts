import { queue, queueWithMessageId } from "./queue";

export const queueAlgoliaReindex = async (
  host: string,
  domain: string,
  basepath?: string
): Promise<void> => {
  return queue({
    host,
    domain,
    basepath,
    endpoint: "/api/fern-docs/search/v2/reindex/algolia",
    method: "GET",
  });
};

export const queueTurbopufferReindex = async (
  host: string,
  domain: string,
  basepath?: string,
  timeoutSeconds?: number
): Promise<void> => {
  return queue({
    host,
    domain,
    basepath,
    endpoint: "/api/fern-docs/search/v2/reindex/turbopuffer",
    method: "GET",
    timeoutSeconds,
  });
};

export const queueTurbopufferStartReindex = async (
  host: string,
  domain: string,
  basepath?: string,
  deleteExisting?: boolean,
  timeoutSeconds?: number
): Promise<string | undefined> => {
  let endpoint = "/api/fern-docs/search/v2/reindex/turbopuffer";

  if (deleteExisting) {
    endpoint += "?deleteExisting=true";
  }

  const messageId = await queueWithMessageId({
    host,
    domain,
    basepath,
    endpoint: endpoint as `/api/fern-docs/${string}`,
    method: "GET",
    timeoutSeconds,
  });

  return messageId;
};
