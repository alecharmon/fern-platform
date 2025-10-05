/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Pure HTTP client for PostHog HogQL queries
 *
 * This client handles only the HTTP communication layer for executing
 * HogQL queries against PostHog's API. It does not contain business logic
 * for specific analytics queries.
 */
import type { HogQLQueryRequest, HogQLQueryResponse, PostHogClientConfig } from "./types";

export class PostHogClientError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly body: string,
        message?: string
    ) {
        super(message || `PostHog API Error: ${status} ${statusText}`);
        this.name = "PostHogClientError";
    }
}

export class PostHogClient {
    private readonly config: Required<PostHogClientConfig>;
    private readonly apiKey: string;

    constructor(config: PostHogClientConfig) {
        const apiKey = process.env.POSTHOG_ANALYTICS_API_KEY;
        if (!apiKey) {
            throw new Error("POSTHOG_ANALYTICS_API_KEY environment variable is required");
        }

        this.apiKey = apiKey;
        this.config = {
            projectId: config.projectId,
            apiUrl: config.apiUrl || "https://us.posthog.com"
        };
    }

    /**
     * Execute a raw HogQL query against PostHog
     */
    async query<T = unknown>(hogqlQuery: string, options: { name?: string } = {}): Promise<HogQLQueryResponse<T>> {
        const url = `${this.config.apiUrl}/api/projects/${this.config.projectId}/query/`;

        const payload: HogQLQueryRequest = {
            query: {
                kind: "HogQLQuery",
                query: hogqlQuery
            },
            name: options.name
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text().catch(() => "");

        if (!response.ok) {
            console.error("PostHog query failed", {
                url,
                payload,
                status: response.status,
                statusText: response.statusText,
                responseText,
                projectId: this.config.projectId
            });

            throw new PostHogClientError(
                response.status,
                response.statusText,
                responseText,
                `Query failed: ${response.status} ${response.statusText}`
            );
        }

        let json: unknown;
        try {
            json = JSON.parse(responseText);
        } catch (e) {
            console.error(
                "Failed to parse PostHog response",
                {
                    url,
                    payload,
                    responseText,
                    projectId: this.config.projectId
                },
                e
            );
            throw new Error("Failed to parse PostHog response");
        }

        return json as HogQLQueryResponse<T>;
    }

    /**
     * Get the configuration for this client instance
     */
    getConfig(): Readonly<PostHogClientConfig> {
        return { ...this.config };
    }
}
