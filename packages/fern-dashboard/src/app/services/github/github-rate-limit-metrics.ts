import type { Octokit } from "@octokit/core";
import * as Sentry from "@sentry/nextjs";

/**
 * Instruments an Octokit instance to report GitHub API rate limit headers
 * as Sentry metrics after each request, and emits a one-time init counter
 * identifying the caller.
 *
 * Emits on creation:
 * - github.api.init (counter) — identifies who created the Octokit instance
 *
 * Emits per request:
 * - github.ratelimit.remaining (gauge)
 * - github.ratelimit.limit (gauge)
 *
 * @param caller - file path + function name, e.g. "auth0/octokit.ts:getUserOctokit"
 */
export function instrumentOctokitRateLimits(
    octokit: Octokit,
    authType: "user" | "fern-bot" | "demo-bot" | "ghe",
    caller: string
): void {
    Sentry.metrics.count("github.api.init", 1, { attributes: { caller, auth_type: authType } });

    octokit.hook.after("request", (_response) => {
        const headers = _response.headers;

        const remaining = headers["x-ratelimit-remaining"];
        const limit = headers["x-ratelimit-limit"];
        const resource = headers["x-ratelimit-resource"] ?? "core";

        const attributes = { auth_type: authType, resource: String(resource) };

        if (remaining != null) {
            Sentry.metrics.gauge("github.ratelimit.remaining", Number(remaining), { attributes });
        }

        if (limit != null) {
            Sentry.metrics.gauge("github.ratelimit.limit", Number(limit), { attributes });
        }
    });
}
