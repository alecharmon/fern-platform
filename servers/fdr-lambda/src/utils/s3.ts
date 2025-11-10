import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { DocsV2Read } from "@fern-api/fdr-sdk";
import { getS3KeyForV1DocsDefinition } from "@fern-api/fdr-sdk/docs";

const ONE_WEEK_IN_SECONDS = 604800;

interface S3Config {
    publicDocsCDNUrl: string;
    publicDocsS3BucketName: string;
    publicDocsS3BucketRegion: string;
    privateDocsS3BucketName: string;
    privateDocsS3BucketRegion: string;
    dbDocsDefinitionS3BucketName: string;
    dbDocsDefinitionS3BucketRegion: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
}

// Initialize S3 clients lazily
let privateDocsS3Client: S3Client | undefined;
let dbDocsDefinitionS3Client: S3Client | undefined;
let s3Config: S3Config | undefined;

export function initializeS3(config: S3Config): void {
    s3Config = config;

    const credentials =
        config.awsAccessKeyId && config.awsSecretAccessKey
            ? {
                  accessKeyId: config.awsAccessKeyId,
                  secretAccessKey: config.awsSecretAccessKey
              }
            : undefined;

    privateDocsS3Client = new S3Client({
        region: config.privateDocsS3BucketRegion,
        credentials
    });

    dbDocsDefinitionS3Client = new S3Client({
        region: config.dbDocsDefinitionS3BucketRegion,
        credentials
    });
}

export async function getPresignedDocsAssetsDownloadUrl({
    key,
    isPrivate
}: {
    key: string;
    isPrivate: boolean;
}): Promise<string> {
    if (!s3Config) {
        throw new Error("S3 not initialized. Call initializeS3() first.");
    }

    if (isPrivate) {
        if (!privateDocsS3Client) {
            throw new Error("Private S3 client not initialized");
        }

        const command = new GetObjectCommand({
            Bucket: s3Config.privateDocsS3BucketName,
            Key: key
        });

        const signedUrl = await getSignedUrl(privateDocsS3Client, command, {
            expiresIn: ONE_WEEK_IN_SECONDS
        });

        return signedUrl;
    }

    return `${s3Config.publicDocsCDNUrl}/${key}`;
}

export async function getDocsDefinitionFromS3(domain: string): Promise<DocsV2Read.LoadDocsForUrlResponse | null> {
    if (!s3Config) {
        throw new Error("S3 not initialized. Call initializeS3() first.");
    }

    if (!dbDocsDefinitionS3Client) {
        throw new Error("DB Docs Definition S3 client not initialized");
    }

    // Check if bucket is configured before attempting S3 read
    if (!s3Config.dbDocsDefinitionS3BucketName || s3Config.dbDocsDefinitionS3BucketName.trim() === "") {
        return null;
    }

    try {
        const key = getS3KeyForV1DocsDefinition(domain);

        const command = new GetObjectCommand({
            Bucket: s3Config.dbDocsDefinitionS3BucketName,
            Key: key
        });
        const response = await dbDocsDefinitionS3Client.send(command);

        if (!response.Body) {
            return null;
        }
        // Convert stream to string
        const bodyString = await response.Body.transformToString();

        const docsDefinition = JSON.parse(bodyString) as DocsV2Read.LoadDocsForUrlResponse;

        return docsDefinition;
    } catch (_error) {
        return null;
    }
}

export async function storeDocsDefinitionInS3(
    domain: string,
    docsDefinition: DocsV2Read.LoadDocsForUrlResponse
): Promise<void> {
    if (!s3Config) {
        throw new Error("S3 not initialized. Call initializeS3() first.");
    }

    if (!dbDocsDefinitionS3Client) {
        throw new Error("DB Docs Definition S3 client not initialized");
    }

    if (!s3Config.dbDocsDefinitionS3BucketName || s3Config.dbDocsDefinitionS3BucketName.trim() === "") {
        throw new Error("DB Docs Definition S3 bucket not configured");
    }

    const key = getS3KeyForV1DocsDefinition(domain);

    const command = new PutObjectCommand({
        Bucket: s3Config.dbDocsDefinitionS3BucketName,
        Key: key,
        Body: JSON.stringify(docsDefinition),
        ContentType: "application/json"
    });
    await dbDocsDefinitionS3Client.send(command);
}
