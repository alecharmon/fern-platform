import * as Sentry from "@sentry/nextjs";
import type { Octokit } from "@octokit/core";

/**
 * Instruments an Octokit instance to report GitHub API rate limit headers
 * as Sentry metrics after each request.
 *
 * Reports:
 * - github.ratelimit.remaining (gauge) - calls remaining in current window
 * - github.ratelimit.limit (gauge) - total call limit for the window
 *
 * Tagged with:
 * - auth_type: "user" | "fern-bot" | "demo-bot" | "ghe"
 * - resource: the rate limit resource bucket (e.g. "core", "search", "graphql")
 */
export function instrumentOctokitRateLimits(octokit: Octokit, authType: "user" | "fern-bot" | "demo-bot" | "ghe"): void {
    octokit.hook.after("request", (_response) => {
        const headers = _response.headers;

        const remaining = headers["x-ratelimit-remaining"];
        const limit = headers["x-ratelimit-limit"];
        const resource = headers["x-ratelimit-resource"] ?? "core";

        const tags = { auth_type: authType, resource: String(resource) };

        if (remaining != null) {
            Sentry.metrics.gauge("github.ratelimit.remaining", Number(remaining), { tags });
        }

        if (limit != null) {
            Sentry.metrics.gauge("github.ratelimit.limit", Number(limit), { tags });
        }
    });
}
