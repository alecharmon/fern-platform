import type { Pool } from "pg";
import { type DocsScoreData, generateDocsScore } from "./generateDocsScore";

export type { DocsScoreData, DocsScoreIssue, IssueCounts, IssueSeverity } from "./generateDocsScore";

export interface DocsScoreRecord {
    domain: string;
    isProcessing: boolean;
    updatedAt: Date;
    data: DocsScoreData | null;
}

// In-memory store for local development only (when no DB is available)
const inMemoryStore = new Map<string, DocsScoreRecord>();

// Check if we're running in local development (not in AWS Lambda)
function isLocalDevelopment(): boolean {
    return !process.env.AWS_LAMBDA_FUNCTION_NAME;
}

export async function getDocsScore(domain: string, pool: Pool | null): Promise<DocsScoreRecord | null> {
    // Use in-memory store only in local development when no DB connection
    if (!pool) {
        if (isLocalDevelopment()) {
            return inMemoryStore.get(domain) ?? null;
        }
        return null;
    }

    try {
        const result = await pool.query(
            `SELECT "domain", "isProcessing", "updatedAt", "data" FROM "docs_scores" WHERE "domain" = $1 LIMIT 1`,
            [domain]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            domain: row.domain,
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
    const now = new Date();

    try {
        // Check for existing processing (in-memory or DB)
        if (!pool) {
            // In-memory mode for local development
            const existing = inMemoryStore.get(domain);
            if (existing?.isProcessing) {
                return existing;
            }

            // Set isProcessing = true in memory
            const processingRecord: DocsScoreRecord = {
                domain,
                isProcessing: true,
                updatedAt: now,
                data: null
            };
            inMemoryStore.set(domain, processingRecord);
        } else {
            // DB mode
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

            // Set isProcessing = true BEFORE starting the calculation
            await pool.query(
                `INSERT INTO "docs_scores" ("domain", "isProcessing", "updatedAt", "data")
                 VALUES ($1, true, $2, NULL)
                 ON CONFLICT ("domain") DO UPDATE SET "isProcessing" = true, "updatedAt" = $2`,
                [domain, now]
            );
        }

        // Start the calculation asynchronously (don't await)
        // This allows the POST to return immediately with isProcessing: true
        runScoreCalculation(domain, pool).catch((error) => {
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.error("[triggerDocsScoreCalculation] Background calculation failed:", error);
        });

        // Return immediately with processing state
        return {
            domain,
            isProcessing: true,
            updatedAt: now,
            data: null
        };
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("[triggerDocsScoreCalculation] Error triggering docs score calculation:", error);
        return null;
    }
}

async function runScoreCalculation(domain: string, pool: Pool | null): Promise<void> {
    try {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log(`[runScoreCalculation] Starting calculation for domain: ${domain}`);

        // Generate health data by scraping sitemap and processing pages
        const healthData = await generateDocsScore(domain);
        const now = new Date();

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log(
            `[runScoreCalculation] Calculation complete for domain: ${domain}, issues: ${healthData.issueCounts.critical} critical, ${healthData.issueCounts.high} high, ${healthData.issueCounts.medium} medium, ${healthData.issueCounts.low} low`
        );

        // Store the result (in-memory or DB)
        if (!pool) {
            // In-memory mode for local development
            inMemoryStore.set(domain, {
                domain,
                isProcessing: false,
                updatedAt: now,
                data: healthData
            });
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[runScoreCalculation] Stored result in memory for domain: ${domain}`);
        } else {
            await pool.query(
                `UPDATE "docs_scores" SET "isProcessing" = false, "updatedAt" = $2, "data" = $3 WHERE "domain" = $1`,
                [domain, now, JSON.stringify(healthData)]
            );
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[runScoreCalculation] Stored result in DB for domain: ${domain}`);
        }
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error(`[runScoreCalculation] Error calculating health data for domain: ${domain}`, error);

        // Reset isProcessing to false so user can retry
        if (!pool) {
            // In-memory mode
            const existing = inMemoryStore.get(domain);
            if (existing) {
                inMemoryStore.set(domain, { ...existing, isProcessing: false });
            }
        } else if (pool) {
            try {
                await pool.query(`UPDATE "docs_scores" SET "isProcessing" = false WHERE "domain" = $1`, [domain]);
            } catch (dbError) {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.error(`[runScoreCalculation] Failed to reset isProcessing for domain: ${domain}`, dbError);
            }
        }
    }
}
