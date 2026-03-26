"use server";

import { fernToken_admin } from "@fern-api/docs-server";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getRedisClient } from "@/app/services/redis/redis";

import { getDocsUrlMetadata } from "../api/utils/getDocsUrlMetadata";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoUsageEntry {
    owner: string;
    repo: string;
    docsUrl: string;
    requestsToday: number;
}

export type GithubUsageData = RepoUsageEntry[];

export interface AllReposUsageEntry {
    owner: string;
    repo: string;
    today: number;
    yesterday: number;
}

export type AllGithubUsageData = AllReposUsageEntry[];

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function getGithubUsageData({
    orgName
}: {
    orgName: Auth0OrgName;
}): Promise<GithubUsageData | { error: string }> {
    const session = await getCurrentSessionOrThrow();

    if (!auth0Management.isSuperUser(session.permissions ?? [])) {
        return { error: "Unauthorized: super-user permission required" };
    }

    try {
        const token = session.accessToken;

        // Get all doc sites for the org
        const sitesResult = await getDocsSitesForOrg({ token, orgName });
        if (!sitesResult.ok) {
            return { error: `Failed to fetch docs sites: ${sitesResult.error.message ?? sitesResult.error.type}` };
        }

        const adminToken = fernToken_admin() ?? token;
        const redis = getRedisClient();
        const today = new Date().toISOString().slice(0, 10);

        // For each doc site, resolve its GitHub repo and query daily count
        const entries = await Promise.all(
            sitesResult.docsSites.map(async (site): Promise<RepoUsageEntry | null> => {
                const domain = site.mainUrl.domain;
                const basepath = site.mainUrl.path;
                const docsUrl = basepath ? `${domain}/${basepath}` : domain;

                try {
                    const metadata = await getDocsUrlMetadata({
                        url: docsUrl as any,
                        token: adminToken
                    });

                    if (!metadata.ok || !metadata.body.gitUrl) {
                        return null;
                    }

                    const parsed = parseGitUrl(metadata.body.gitUrl);
                    if (!parsed.owner || !parsed.repo) {
                        return null;
                    }

                    const key = `github-usage:${parsed.owner}:${parsed.repo}:${today}`;
                    const count = await redis.get<number>(key).catch(() => null);

                    return {
                        owner: parsed.owner,
                        repo: parsed.repo,
                        docsUrl,
                        requestsToday: count ?? 0
                    };
                } catch {
                    return null;
                }
            })
        );

        // Filter nulls and deduplicate by owner/repo
        const seen = new Set<string>();
        const results: RepoUsageEntry[] = [];
        for (const entry of entries) {
            if (entry == null) {
                continue;
            }
            const key = `${entry.owner}/${entry.repo}`;
            if (!seen.has(key)) {
                seen.add(key);
                results.push(entry);
            }
        }

        return results;
    } catch (error: unknown) {
        console.error("[getGithubUsageData] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch GitHub usage data" };
    }
}

// ---------------------------------------------------------------------------
// All Repos Usage (across all users, today + yesterday)
// ---------------------------------------------------------------------------

/**
 * Scans Redis for all `github-usage:*` keys and returns aggregated
 * request counts for today and yesterday, across all repos globally.
 * Requires super-user permission.
 */
export async function getAllGithubUsageData(): Promise<AllGithubUsageData | { error: string }> {
    const session = await getCurrentSessionOrThrow();

    if (!auth0Management.isSuperUser(session.permissions ?? [])) {
        return { error: "Unauthorized: super-user permission required" };
    }

    try {
        const redis = getRedisClient();
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

        // Scan for all github-usage keys matching today or yesterday
        const keys: string[] = [];
        let cursor: string | number = 0;
        do {
            const result: any = await redis.scan(cursor, { match: "github-usage:*", count: 200 });
            cursor = result[0];
            keys.push(...result[1]);
        } while (cursor.toString() !== "0");

        // Filter to only today/yesterday keys and group by owner/repo
        const repoMap = new Map<string, { owner: string; repo: string; today: number; yesterday: number }>();

        // Batch fetch all values
        const relevantKeys = keys.filter((k) => k.endsWith(`:${today}`) || k.endsWith(`:${yesterday}`));

        if (relevantKeys.length === 0) {
            return [];
        }

        const values = await Promise.all(relevantKeys.map((k) => redis.get<number>(k).catch(() => 0)));

        for (let i = 0; i < relevantKeys.length; i++) {
            const key = relevantKeys[i]!;
            const count = values[i] ?? 0;

            if (count === 0) {
                continue;
            }

            // Parse key: github-usage:{owner}:{repo}:{date}
            const parts = key.split(":");
            // parts = ["github-usage", owner, repo, date]
            if (parts.length < 4) {
                continue;
            }
            const owner = parts[1]!;
            const repo = parts[2]!;
            const date = parts[3]!;
            const repoKey = `${owner}/${repo}`;

            let entry = repoMap.get(repoKey);
            if (!entry) {
                entry = { owner, repo, today: 0, yesterday: 0 };
                repoMap.set(repoKey, entry);
            }

            if (date === today) {
                entry.today = count;
            } else if (date === yesterday) {
                entry.yesterday = count;
            }
        }

        return Array.from(repoMap.values());
    } catch (error: unknown) {
        console.error("[getAllGithubUsageData] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch all GitHub usage data" };
    }
}
