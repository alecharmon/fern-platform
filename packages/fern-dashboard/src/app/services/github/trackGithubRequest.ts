import type { Octokit } from "@octokit/core";

import { getRedisClient } from "@/app/services/redis/redis";

const ONE_DAY_SECONDS = 86_400;

/**
 * Returns today's date as YYYY-MM-DD in UTC.
 */
function todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Records a GitHub API request by incrementing a daily counter in Redis.
 * Key format: github-usage:{owner}:{repo}:{YYYY-MM-DD}
 * Fire-and-forget — errors are silently ignored, never thrown.
 */
async function recordGithubRequest(owner: string, repo: string): Promise<void> {
    try {
        const redis = getRedisClient();
        const key = `github-usage:${owner}:${repo}:${todayUTC()}`;

        await redis.incr(key);
        await redis.expire(key, ONE_DAY_SECONDS * 2);
    } catch (e) {
        console.error("[trackGithubRequest] Failed to record request:", e);
    }
}

/**
 * Wraps an Octokit instance with a request hook that tracks
 * every GitHub API call in Redis by owner and repo.
 */
export function withRequestTracking(octokit: Octokit): Octokit {
    octokit.hook.after("request", (_response, options) => {
        const owner = (options as Record<string, unknown>).owner;
        const repo = (options as Record<string, unknown>).repo;
        if (typeof owner === "string" && typeof repo === "string") {
            recordGithubRequest(owner, repo);
        }
    });
    return octokit;
}
