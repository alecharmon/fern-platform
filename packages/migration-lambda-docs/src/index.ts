import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { PrismaClient } from "@prisma/client";

interface RDSSecret {
    username: string;
    password: string;
    engine: string;
    host: string;
    port: number;
    dbname: string;
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
        cachedDatabaseUrl = `postgresql://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.dbname}?sslmode=require`;

        return cachedDatabaseUrl;
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("Failed to fetch database credentials from Secrets Manager:", error);
        throw error;
    }
}

interface LambdaEvent {
    testConnection?: boolean;
}

export const handler = async (event: unknown): Promise<{ statusCode: number; body: string }> => {
    const parsedEvent = (event as LambdaEvent) || {};
    const testMode = parsedEvent.testConnection === true;

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(testMode ? "Testing database connection..." : "Starting Prisma migration...");
    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log("Event:", JSON.stringify(event, null, 2));

    let prisma: PrismaClient | null = null;

    try {
        const databaseUrl = await getDatabaseUrl();
        process.env.DATABASE_URL = databaseUrl;

        prisma = new PrismaClient({
            datasources: {
                db: {
                    url: databaseUrl
                }
            }
        });

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Connecting to database...");
        await prisma.$connect();
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Connected to database successfully");

        // Test a simple query to verify connection
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Testing database query...");
        await prisma.$queryRaw`SELECT 1`;
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log("Database query successful");

        let migrationOutput = "";

        if (!testMode) {
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log("Running migrations...");
            const { execSync } = await import("child_process");

            migrationOutput = execSync("npx prisma migrate deploy --schema=/var/task/prisma/schema.prisma", {
                encoding: "utf-8",
                env: {
                    ...process.env,
                    DATABASE_URL: databaseUrl
                }
            });

            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log("Migration output:", migrationOutput);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: testMode ? "Database connection test successful" : "Migrations completed successfully",
                testMode,
                output: migrationOutput || "Connection test only - no migrations run"
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
        if (prisma) {
            try {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.log("Disconnecting from database...");
                await prisma.$disconnect();
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.log("Disconnected successfully");
            } catch (disconnectError) {
                // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
                console.error("Error disconnecting from database:", disconnectError);
            }
        }
    }
};
