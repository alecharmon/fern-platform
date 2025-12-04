import { queue } from "./queue";

export const queueAlgoliaReindex = async (host: string, domain: string, basepath?: string): Promise<void> => {
    return queue({
        host,
        domain,
        basepath,
        endpoint: "/api/fern-docs/search/v2/reindex/algolia",
        method: "GET"
    });
};
