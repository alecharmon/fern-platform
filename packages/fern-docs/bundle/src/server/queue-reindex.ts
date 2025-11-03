import { queue, queueWithMessageId } from "./queue";

export const queueAlgoliaReindex = async (host: string, domain: string, basepath?: string): Promise<void> => {
    return queue({
        host,
        domain,
        basepath,
        endpoint: "/api/fern-docs/search/v2/reindex/algolia",
        method: "GET"
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
        failureCallback: process.env.FAI_SERVER_URL
            ? `${process.env.FAI_SERVER_URL}/upstash/qstash/failure-callback`
            : `https://fai.buildwithfern.com/upstash/qstash/failure-callback`
    });
};

export const queueTurbopufferStartReindex = async ({
    host,
    domain,
    basepath,
    deleteExisting,
    timeoutSeconds,
    callback
}: {
    host: string;
    domain: string;
    basepath?: string;
    deleteExisting?: boolean;
    timeoutSeconds?: number;
    callback?: string;
}): Promise<string | undefined> => {
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
        callback,
        failureCallback: process.env.FAI_SERVER_URL
            ? `${process.env.FAI_SERVER_URL}/upstash/qstash/failure-callback`
            : `https://fai.buildwithfern.com/upstash/qstash/failure-callback`
    });

    return messageId;
};
