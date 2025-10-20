/**
 * Algolia Analytics Client using official algoliasearch SDK
 *
 * This client uses the official Algolia JavaScript client to interact
 * with the Analytics API.
 */
import { type AnalyticsClient, algoliasearch } from "algoliasearch";

import type { AlgoliaClientConfig } from "./types";

export class AlgoliaClientError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly body: string,
        message?: string
    ) {
        super(message || `Algolia API Error: ${status} ${statusText}`);
        this.name = "AlgoliaClientError";
    }
}

export class AlgoliaAnalyticsClient {
    private readonly config: AlgoliaClientConfig;
    private readonly client: AnalyticsClient;

    constructor(config: Partial<AlgoliaClientConfig> = {}) {
        const appId = config.appId || process.env.ALGOLIA_APP_ID;
        const apiKey = config.apiKey || process.env.ALGOLIA_SEARCH_API_KEY;
        const indexName = "fern_docs_search"; // Default to fern_docs_search

        if (!appId) {
            throw new Error("ALGOLIA_APP_ID environment variable or config.appId is required");
        }
        if (!apiKey) {
            throw new Error("ALGOLIA_SEARCH_API_KEY environment variable or config.apiKey is required");
        }

        this.config = {
            appId,
            apiKey,
            indexName
        };

        // Initialize Algolia client
        this.client = algoliasearch(appId, apiKey).initAnalytics({ region: "us" });
    }

    /**
     * Get top searches for an index
     */
    async getTopSearches(params: {
        index?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        tags?: string;
    }): Promise<unknown> {
        const index = params.index || this.config.indexName;

        try {
            const response = await this.client.getTopSearches({
                index,
                startDate: params.startDate,
                endDate: params.endDate,
                limit: params.limit,
                tags: params.tags
            });
            return response;
        } catch (error: any) {
            console.error("Algolia getTopSearches failed", {
                index,
                params,
                error: error.message
            });
            throw new AlgoliaClientError(
                error.status || 500,
                error.statusText || "Unknown Error",
                error.message || "",
                `getTopSearches failed: ${error.message}`
            );
        }
    }

    /**
     * Get searches with no results
     */
    async getSearchesWithNoResults(params: {
        index?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        tags?: string;
    }): Promise<unknown> {
        const index = params.index || this.config.indexName;

        try {
            const response = await this.client.getSearchesNoResults({
                index,
                startDate: params.startDate,
                endDate: params.endDate,
                limit: params.limit,
                tags: params.tags
            });
            return response;
        } catch (error: any) {
            console.error("Algolia getSearchesNoResults failed", {
                index,
                params,
                error: error.message
            });
            throw new AlgoliaClientError(
                error.status || 500,
                error.statusText || "Unknown Error",
                error.message || "",
                `getSearchesNoResults failed: ${error.message}`
            );
        }
    }

    /**
     * Get search count and metrics
     */
    async getSearchCount(params: {
        index?: string;
        startDate?: string;
        endDate?: string;
        tags?: string;
    }): Promise<unknown> {
        const index = params.index || this.config.indexName;

        try {
            const response = await this.client.getSearchesCount({
                index,
                startDate: params.startDate,
                endDate: params.endDate,
                tags: params.tags
            });
            return response;
        } catch (error: any) {
            console.error("Algolia getSearchesCount failed", {
                index,
                params,
                error: error.message
            });
            throw new AlgoliaClientError(
                error.status || 500,
                error.statusText || "Unknown Error",
                error.message || "",
                `getSearchesCount failed: ${error.message}`
            );
        }
    }

    /**
     * Get no results rate
     */
    async getNoResultsRate(params: {
        index?: string;
        startDate?: string;
        endDate?: string;
        tags?: string;
    }): Promise<unknown> {
        const index = params.index || this.config.indexName;

        try {
            const response = await this.client.getNoResultsRate({
                index,
                startDate: params.startDate,
                endDate: params.endDate,
                tags: params.tags
            });
            return response;
        } catch (error: any) {
            console.error("Algolia getSearchesNoResultRate failed", {
                index,
                params,
                error: error.message
            });
            throw new AlgoliaClientError(
                error.status || 500,
                error.statusText || "Unknown Error",
                error.message || "",
                `getSearchesNoResultRate failed: ${error.message}`
            );
        }
    }

    /**
     * Get click-through rate
     */
    async getClickThroughRate(params: {
        index?: string;
        startDate?: string;
        endDate?: string;
        tags?: string;
    }): Promise<unknown> {
        const index = params.index || this.config.indexName;

        try {
            const response = await this.client.getClickThroughRate({
                index,
                startDate: params.startDate,
                endDate: params.endDate,
                tags: params.tags
            });
            return response;
        } catch (error: any) {
            console.error("Algolia getClickThroughRate failed", {
                index,
                params,
                error: error.message
            });
            throw new AlgoliaClientError(
                error.status || 500,
                error.statusText || "Unknown Error",
                error.message || "",
                `getClickThroughRate failed: ${error.message}`
            );
        }
    }

    /**
     * Get the configuration for this client instance
     */
    getConfig(): Readonly<AlgoliaClientConfig> {
        return { ...this.config };
    }
}
