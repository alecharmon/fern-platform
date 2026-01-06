import type { Pool } from "pg";
import { type DocsScoreData, generateDocsScore } from "./generateDocsScore";

export type { DocsScoreCategory, DocsScoreData, DocsScoreIssue } from "./generateDocsScore";

export interface DocsScoreRecord {
    domain: string;
    score: number | null;
    isProcessing: boolean;
    updatedAt: Date;
    data: DocsScoreData | null;
}

export async function getDocsScore(domain: string, pool: Pool | null): Promise<DocsScoreRecord | null> {
    if (!pool) {
        return null;
    }

    try {
        const result = await pool.query(
            `SELECT "domain", "score", "isProcessing", "updatedAt", "data" FROM "docs_scores" WHERE "domain" = $1 LIMIT 1`,
            [domain]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            domain: row.domain,
            score: row.score,
            isProcessing: row.isProcessing,
            updatedAt: row.updatedAt,
            data: row.data
        };
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("[getDocsScore] Error retrieving docs score:", error);
        return null;
    }
}

export async function triggerDocsScoreCalculation(domain: string, pool: Pool | null): Promise<DocsScoreRecord | null> {
    if (!pool) {
        return null;
    }

    try {
        const existingResult = await pool.query(
            `SELECT "domain", "isProcessing" FROM "docs_scores" WHERE "domain" = $1 LIMIT 1`,
            [domain]
        );

        if (existingResult.rows.length > 0 && existingResult.rows[0].isProcessing) {
            const current = await getDocsScore(domain, pool);
            if (current) {
                return current;
            }
        }

        // Generate score using stub function
        // TODO: Replace with actual scraping/calculation logic
        const calculatedScore = generateDocsScore(domain);
        const now = new Date();

        // Insert the calculated score into the database
        await pool.query(
            `INSERT INTO "docs_scores" ("domain", "score", "isProcessing", "updatedAt", "data")
             VALUES ($1, $2, false, $3, $4)
             ON CONFLICT ("domain") DO UPDATE SET "score" = $2, "isProcessing" = false, "updatedAt" = $3, "data" = $4`,
            [domain, calculatedScore.score, now, JSON.stringify(calculatedScore.data)]
        );

        // Return the inserted record directly instead of re-querying
        return {
            domain,
            score: calculatedScore.score,
            isProcessing: false,
            updatedAt: now,
            data: calculatedScore.data
        };
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("[triggerDocsScoreCalculation] Error triggering docs score calculation:", error);
        return null;
    }
}
