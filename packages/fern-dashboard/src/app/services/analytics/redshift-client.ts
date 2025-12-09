import { Pool, type PoolConfig } from "pg";

/**
 * Redshift connection pool for analytics queries
 * Uses PostgreSQL wire protocol (pg library)
 */
let redshiftPool: Pool | null = null;

export function getRedshiftPool(): Pool {
    if (redshiftPool) {
        return redshiftPool;
    }

    const host = process.env.POSTHOG_REDSHIFT_DB_HOST;
    const database = process.env.POSTHOG_REDSHIFT_DB_NAME || "dev";
    const user = process.env.POSTHOG_REDSHIFT_DB_USER;
    const password = process.env.POSTHOG_REDSHIFT_DB_PASSWORD;

    if (!host || !user || !password) {
        throw new Error(
            "Missing required Redshift env vars: POSTHOG_REDSHIFT_DB_HOST, POSTHOG_REDSHIFT_DB_USER, POSTHOG_REDSHIFT_DB_PASSWORD"
        );
    }

    const config: PoolConfig = {
        host,
        port: 5439,
        database,
        user,
        password,
        ssl: {
            rejectUnauthorized: false // Redshift requires SSL but uses self-signed certs
        },
        max: 50, // Large pool size for high concurrency
        idleTimeoutMillis: 120000,
        connectionTimeoutMillis: 120000, // 2 minute timeout for 30-day period queries
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        statement_timeout: 120000 // Query timeout (2 minutes)
    };

    console.log(`[Redshift] Connecting to ${host}:5439 database=${database} user=${user}`);

    redshiftPool = new Pool(config);

    // Log connection errors
    redshiftPool.on("error", (err) => {
        console.error("Unexpected error on idle Redshift client", err);
    });

    return redshiftPool;
}

/**
 * Close the connection pool (for cleanup)
 */
export async function closeRedshiftPool(): Promise<void> {
    if (redshiftPool) {
        await redshiftPool.end();
        redshiftPool = null;
    }
}
