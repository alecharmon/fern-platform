/* eslint-disable turbo/no-undeclared-env-vars */
/**
 * Pure HTTP client for PostHog HogQL queries
 *
 * This client handles only the HTTP communication layer for executing
 * HogQL queries against PostHog's API. It does not contain business logic
 * for specific analytics queries.
 */
import { appendFileSync, existsSync, writeFileSync } from "fs";

import type { HogQLQueryRequest, HogQLQueryResponse, PostHogClientConfig } from "./types";

export interface QueryProfile {
    timestamp: string;
    org?: string;
    docs_site?: string;
    range_days?: number;
    query_type: string;
    duration_ms: number;
    success: boolean;
    error?: string;
}

let profilingEnabled = false;
let profilingOutputPath: string | null = null;
let profilingContext: {
    org?: string;
    docs_site?: string;
    range_days?: number;
} = {};

export function enableProfiling(outputPath: string): void {
    profilingEnabled = true;
    profilingOutputPath = outputPath;
    if (!existsSync(outputPath)) {
        writeFileSync(outputPath, "[\n");
    }
}

export function disableProfiling(): void {
    if (profilingEnabled && profilingOutputPath) {
        try {
            appendFileSync(profilingOutputPath, "]\n");
        } catch {
            // ignore
        }
    }
    profilingEnabled = false;
    profilingOutputPath = null;
    profilingContext = {};
}

export function setProfilingContext(ctx: { org?: string; docs_site?: string; range_days?: number }): void {
    profilingContext = ctx;
}

let isFirstProfileEntry = true;

function logQueryProfile(profile: QueryProfile): void {
    // biome-ignore lint/style/useBlockStatements: early return guard clause
    if (!profilingEnabled || !profilingOutputPath) return;
    try {
        const prefix = isFirstProfileEntry ? "" : ",\n";
        isFirstProfileEntry = false;
        appendFileSync(profilingOutputPath, prefix + JSON.stringify(profile));
    } catch {
        // ignore write errors
    }
}

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

        const startTime = performance.now();
        let success = true;
        let errorMsg: string | undefined;

        try {
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
                success = false;
                errorMsg = `${response.status} ${response.statusText}`;
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
                success = false;
                errorMsg = "JSON parse error";
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
        } catch (err) {
            success = false;
            if (!errorMsg) {
                errorMsg = err instanceof Error ? err.message : String(err);
            }
            throw err;
        } finally {
            const duration = performance.now() - startTime;
            if (profilingEnabled) {
                const queryType = options.name || "unknown";
                logQueryProfile({
                    timestamp: new Date().toISOString(),
                    org: profilingContext.org,
                    docs_site: profilingContext.docs_site,
                    range_days: profilingContext.range_days,
                    query_type: queryType,
                    duration_ms: Math.round(duration),
                    success,
                    error: errorMsg
                });
            }
        }
    }

    /**
     * Get the configuration for this client instance
     */
    getConfig(): Readonly<PostHogClientConfig> {
        return { ...this.config };
    }
}
