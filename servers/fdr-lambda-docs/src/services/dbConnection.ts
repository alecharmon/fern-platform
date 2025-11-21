import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const SECRET_ID = process.env.DOCS_DB_SECRET_ID;
const REGION = process.env.DOCS_DB_SECRET_REGION ?? process.env.AWS_REGION ?? "us-east-1";

let cachedDbUrl: string | null = null;

interface RDSSecret {
    username: string;
    password: string;
    host: string;
    port: number;
    dbname: string;
    engine: string;
}

export async function getDatabaseUrl(): Promise<string | null> {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }

    if (cachedDbUrl) {
        return cachedDbUrl;
    }

    if (!SECRET_ID) {
        return null;
    }

    try {
        const client = new SecretsManagerClient({ region: REGION });
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: SECRET_ID,
                VersionStage: "AWSCURRENT"
            })
        );

        if (!response.SecretString) {
            return null;
        }

        const secret = JSON.parse(response.SecretString) as RDSSecret;

        const url = `postgresql://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@${secret.host}:${secret.port}/${secret.dbname}?sslmode=require`;

        process.env.DATABASE_URL = url;
        cachedDbUrl = url;

        return url;
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error("[dbConnection] Error fetching database secret:", error);
        return null;
    }
}
