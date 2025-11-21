import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Client } from "pg";

interface RDSSecret {
    username: string;
    password: string;
    engine?: string;
    host?: string;
    port?: number;
    dbname?: string;
}

interface LambdaEvent {
    testConnection?: boolean;
}

let cachedDatabaseUrl: string | null = null;

async function getDatabaseUrl(): Promise<string> {
    if (cachedDatabaseUrl) {
        return cachedDatabaseUrl;
    }

    const secretId = process.env.DOCS_DB_SECRET_ID;
    if (!secretId) {
        throw new Error("DOCS_DB_SECRET_ID environment variable is not set");
    }

    const client = new SecretsManagerClient({ region: "us-east-1" });

    try {
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secretId,
                VersionStage: "AWSCURRENT"
            })
        );

        if (!response.SecretString) {
            throw new Error("Secret value is empty");
        }

        const secret: RDSSecret = JSON.parse(response.SecretString);

        // Get connection details from secret or environment variables
        const host = secret.host || process.env.DB_HOST || "lambda-docs-db.cihbconq6tcp.us-east-1.rds.amazonaws.com";
        const port = secret.port || process.env.DB_PORT || "5432";
        const dbname = secret.dbname || process.env.DB_NAME || "lambdadocsdb";

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Connection details:", {
            username: secret.username,
            host: host ? "***" : undefined,
            port,
            dbname,
            source: {
                hostFrom: secret.host ? "secret" : "env",
                portFrom: secret.port ? "secret" : "env",
                dbnameFrom: secret.dbname ? "secret" : "env"
            }
        });

        // Validate required fields
        if (!host) {
            throw new Error("Database host not found in secret or DB_HOST environment variable");
        }
        if (!dbname) {
            throw new Error("Database name not found in secret or DB_NAME environment variable");
        }

        // Validate port
        const portNum = Number(port);
        if (Number.isNaN(portNum) || portNum <= 0 || portNum > 65535) {
            throw new Error(`Invalid port number: ${port}`);
        }

        // Store connection details (not full URL) for object-based config
        cachedDatabaseUrl = JSON.stringify({
            host,
            port: portNum,
            database: dbname,
            user: secret.username,
            password: secret.password
        });

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Database connection details prepared");

        return cachedDatabaseUrl;
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("Failed to fetch database credentials from Secrets Manager:", error);
        throw error;
    }
}

async function runMigrations(connectionDetailsJson: string): Promise<string> {
    const connectionDetails = JSON.parse(connectionDetailsJson);
    const client = new Client({
        ...connectionDetails,
        ssl: {
            rejectUnauthorized: false // Accept RDS self-signed certs in VPC
        }
    });

    try {
        await client.connect();
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Connected to database");

        // Create migrations tracking table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        // Read migration directories
        const migrationsPath = "/var/task/migrations";
        const migrationDirs = await readdir(migrationsPath);

        // Filter and sort migration directories (exclude migration_lock.toml)
        const validMigrations = migrationDirs.filter((name) => !name.endsWith(".toml") && !name.startsWith(".")).sort();

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log(`Found ${validMigrations.length} migration(s)`);

        let appliedCount = 0;

        for (const migrationDir of validMigrations) {
            // Check if already applied
            const result = await client.query("SELECT 1 FROM _migrations WHERE name = $1", [migrationDir]);

            if (result.rows.length === 0) {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.log(`Applying migration: ${migrationDir}`);

                // Read and execute migration SQL
                const sqlPath = join(migrationsPath, migrationDir, "migration.sql");
                const sql = await readFile(sqlPath, "utf-8");

                // Run in a transaction
                await client.query("BEGIN");
                try {
                    await client.query(sql);
                    await client.query("INSERT INTO _migrations (name) VALUES ($1)", [migrationDir]);
                    await client.query("COMMIT");

                    appliedCount++;
                    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                    console.log(`✓ Applied: ${migrationDir}`);
                } catch (error) {
                    await client.query("ROLLBACK");
                    throw error;
                }
            } else {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.log(`⊘ Already applied: ${migrationDir}`);
            }
        }

        return appliedCount > 0 ? `Applied ${appliedCount} migration(s)` : "No pending migrations";
    } finally {
        await client.end();
    }
}

export const handler = async (event: unknown): Promise<{ statusCode: number; body: string }> => {
    const parsedEvent = (event as LambdaEvent) || {};
    const testMode = parsedEvent.testConnection === true;

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(testMode ? "Testing database connection..." : "Starting migrations...");
    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log("Event:", JSON.stringify(event, null, 2));

    let client: Client | null = null;

    try {
        const connectionDetailsJson = await getDatabaseUrl();
        const connectionDetails = JSON.parse(connectionDetailsJson);
        client = new Client({
            ...connectionDetails,
            ssl: {
                rejectUnauthorized: false // Accept RDS self-signed certs in VPC
            }
        });

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Connecting to database...");
        await client.connect();
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Connected successfully");

        // Test query
        await client.query("SELECT 1");
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Database query successful");

        let output = "Connection test only - no migrations run";

        if (!testMode) {
            await client.end();
            output = await runMigrations(connectionDetailsJson);
            client = null; // Already closed in runMigrations
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: testMode ? "Database connection test successful" : "Migrations completed successfully",
                testMode,
                output
            })
        };
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error(testMode ? "Connection test failed:" : "Migration failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: testMode ? "Database connection test failed" : "Migration failed",
                error: error instanceof Error ? error.message : String(error)
            })
        };
    } finally {
        // Always disconnect from database to prevent resource leaks
        if (client) {
            try {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.log("Disconnecting from database...");
                await client.end();
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.log("Disconnected successfully");
            } catch (disconnectError) {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.error("Error disconnecting from database:", disconnectError);
            }
        }
    }
};
