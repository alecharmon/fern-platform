import { NextResponse } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";
import { getRedisClient } from "@/app/services/redis/redis";

import type { AllGithubUsageData } from "../../actions/getGithubRpmData";

export async function GET(): Promise<NextResponse<AllGithubUsageData | { error: string }>> {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!auth0Management.isSuperUser(session.permissions ?? [])) {
        return NextResponse.json({ error: "Unauthorized: super-user permission required" }, { status: 403 });
    }

    try {
        const redis = getRedisClient();
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

        // Scan for all github-usage keys
        const keys: string[] = [];
        let cursor: string | number = 0;
        do {
            const result: any = await redis.scan(cursor, { match: "github-usage:*", count: 200 });
            cursor = result[0];
            keys.push(...result[1]);
        } while (cursor.toString() !== "0");

        // Filter to only today/yesterday keys
        const relevantKeys = keys.filter((k) => k.endsWith(`:${today}`) || k.endsWith(`:${yesterday}`));

        if (relevantKeys.length === 0) {
            return NextResponse.json([]);
        }

        const values = await Promise.all(relevantKeys.map((k) => redis.get<number>(k).catch(() => 0)));

        const repoMap = new Map<string, { owner: string; repo: string; today: number; yesterday: number }>();

        for (let i = 0; i < relevantKeys.length; i++) {
            const key = relevantKeys[i]!;
            const count = values[i] ?? 0;

            if (count === 0) {
                continue;
            }

            const parts = key.split(":");
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

        return NextResponse.json(Array.from(repoMap.values()));
    } catch (error: unknown) {
        console.error("[GET /api/github-usage] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch GitHub usage data" },
            { status: 500 }
        );
    }
}
