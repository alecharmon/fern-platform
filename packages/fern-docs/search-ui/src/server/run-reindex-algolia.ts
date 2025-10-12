import "server-only";

import {
    type AlgoliaIndexerTaskResponse,
    algoliaIndexerTask,
    algoliaIndexSettingsTask,
    SEARCH_INDEX
} from "@fern-docs/search-keyword";

import { algoliaAppId, algoliaWriteApiKey, fdrEnvironment, fernToken_admin } from "./env-variables";

export const runReindexAlgolia = async (domain: string): Promise<AlgoliaIndexerTaskResponse> => {
    console.time("reindexing");

    await algoliaIndexSettingsTask({
        appId: algoliaAppId(),
        writeApiKey: algoliaWriteApiKey(),
        indexName: SEARCH_INDEX
    });

    const response = await algoliaIndexerTask({
        appId: algoliaAppId(),
        writeApiKey: algoliaWriteApiKey(),
        indexName: SEARCH_INDEX,
        environment: fdrEnvironment(),
        fernToken: fernToken_admin(),
        domain
    });

    console.timeEnd("reindexing");

    return response;
};
