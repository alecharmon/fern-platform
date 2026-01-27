import {
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    type PutObjectCommandInput,
    type PutObjectCommandOutput,
    S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type APIV1Db, APIV1Write, type DocsV1Write, type DocsV2Write, FdrAPI } from "@fern-api/fdr-sdk";
import { getS3KeyForV1DocsDefinition } from "@fern-api/fdr-sdk/docs";
import { v4 as uuidv4 } from "uuid";
import type { FernRegistry } from "../../api/generated";
import type { DynamicIr } from "../../api/generated/api/resources/api/resources/v1/resources/register";
import type { FdrApplication, FdrConfig } from "../../app";
import { Cache } from "../../Cache";

const _ONE_WEEK_IN_SECONDS = 604800;
const ONE_DAY_IN_SECONDS = 86400;

export interface S3DocsFileInfo {
    presignedUrl: DocsV1Write.FileS3UploadUrl;
    key: string;
    imageMetadata:
        | {
              width: number;
              height: number;
              blurDataUrl: string | undefined;
              alt: string | undefined;
          }
        | undefined;
}

export interface S3DocsUploadResult {
    fileInfos: Record<DocsV1Write.FilePath, S3DocsFileInfo>;
    skippedFiles: DocsV1Write.FilePath[];
}

export interface S3ApiDefinitionSourceFileInfo {
    presignedUrl: string;
    key: string;
}

export interface S3Service {
    writeLoadDocsForUrlResponse({
        domain,
        readDocsDefinition
    }: {
        domain: string;
        readDocsDefinition: FernRegistry.docs.v2.read.LoadDocsForUrlResponse;
    }): Promise<PutObjectCommandOutput>;
    getPresignedDocsAssetsUploadUrls({
        domain,
        filepaths,
        images,
        isPrivate
    }: {
        domain: string;
        filepaths: DocsV2Write.FilePathInput[];
        images: DocsV2Write.ImageFilePath[];
        isPrivate: boolean;
    }): Promise<S3DocsUploadResult>;

    getPresignedDocsAssetsDownloadUrl({ key, isPrivate }: { key: string; isPrivate: boolean }): Promise<FdrAPI.Url>;

    checkFileExists({ key, isPrivate }: { key: string; isPrivate: boolean }): Promise<boolean>;

    getPresignedApiDefinitionSourceUploadUrls({
        orgId,
        apiId,
        sources
    }: {
        orgId: FernRegistry.OrgId;
        apiId: FernRegistry.ApiId;
        sources: Record<APIV1Write.SourceId, APIV1Write.Source> | undefined;
    }): Promise<Record<APIV1Write.SourceId, S3ApiDefinitionSourceFileInfo>>;

    getPresignedApiDefinitionDynamicIRsUploadUrls({
        orgId,
        apiId,
        dynamicIRs
    }: {
        orgId: FernRegistry.OrgId;
        apiId: APIV1Db.ApiDefinitionId;
        dynamicIRs: Record<string, DynamicIr> | undefined;
    }): Promise<Record<string, S3ApiDefinitionSourceFileInfo>>;

    getPresignedDynamicIrUploadUrlsForSdk({
        orgId,
        version,
        snippetConfiguration
    }: {
        orgId: FernRegistry.OrgId;
        version: string;
        snippetConfiguration: Record<string, string>;
    }): Promise<Record<string, S3ApiDefinitionSourceFileInfo>>;

    updateSdkDynamicIrLatestPointer({
        orgId,
        version,
        snippetConfiguration
    }: {
        orgId: FernRegistry.OrgId;
        version: string;
        snippetConfiguration: Record<string, string>;
    }): Promise<void>;

    checkSdkDynamicIrExists({
        orgId,
        snippetConfiguration
    }: {
        orgId: FernRegistry.OrgId;
        snippetConfiguration: Record<string, { packageName: string; version?: string }>;
    }): Promise<Record<string, string>>;

    getPresignedApiDefinitionSourceDownloadUrl({ key }: { key: string }): Promise<string>;

    deleteDocsAssetsByDomain({ domain }: { domain: string }): Promise<{ deletedCount: number }>;
}

export class S3ServiceImpl implements S3Service {
    private publicDocsCDNUrl: string;
    private publicDocsS3: S3Client;
    private privateDocsS3: S3Client;
    private privateApiDefinitionSourceS3: S3Client;
    private dbDocsDefinitionS3: S3Client;
    private presignedDownloadUrlCache = new Cache<string>(10_000, ONE_DAY_IN_SECONDS);

    constructor(
        private readonly config: FdrConfig,
        private readonly app: FdrApplication
    ) {
        this.publicDocsCDNUrl = config.cdnPublicDocsUrl;
        this.publicDocsS3 = new S3Client({
            ...(config.publicDocsS3.urlOverride != null ? { endpoint: config.publicDocsS3.urlOverride } : {}),
            region: config.publicDocsS3.bucketRegion,
            forcePathStyle: config.publicDocsS3.forcePathStyle ?? false,
            credentials: {
                accessKeyId: config.awsAccessKey,
                secretAccessKey: config.awsSecretKey
            }
        });
        this.privateDocsS3 = new S3Client({
            ...(config.privateDocsS3.urlOverride != null ? { endpoint: config.privateDocsS3.urlOverride } : {}),
            region: config.privateDocsS3.bucketRegion,
            forcePathStyle: config.privateDocsS3.forcePathStyle ?? false,
            credentials: {
                accessKeyId: config.awsAccessKey,
                secretAccessKey: config.awsSecretKey
            }
        });
        this.dbDocsDefinitionS3 = new S3Client({
            ...(config.dbDocsDefinitionS3.urlOverride != null
                ? { endpoint: config.dbDocsDefinitionS3.urlOverride }
                : {}),
            region: config.dbDocsDefinitionS3.bucketRegion,
            forcePathStyle: config.dbDocsDefinitionS3.forcePathStyle ?? false,
            credentials: {
                accessKeyId: config.awsAccessKey,
                secretAccessKey: config.awsSecretKey
            }
        });
        this.privateApiDefinitionSourceS3 = new S3Client({
            ...(config.privateApiDefinitionSourceS3.urlOverride != null
                ? { endpoint: config.privateApiDefinitionSourceS3.urlOverride }
                : {}),
            region: config.privateApiDefinitionSourceS3.bucketRegion,
            forcePathStyle: config.privateApiDefinitionSourceS3.forcePathStyle ?? false,
            credentials: {
                accessKeyId: config.awsAccessKey,
                secretAccessKey: config.awsSecretKey
            }
        });
    }

    async writeLoadDocsForUrlResponse({
        domain,
        readDocsDefinition
    }: {
        domain: string;
        readDocsDefinition: FernRegistry.docs.v2.read.LoadDocsForUrlResponse;
    }): Promise<PutObjectCommandOutput> {
        const command = new PutObjectCommand({
            Bucket: this.config.dbDocsDefinitionS3.bucketName,
            Key: getS3KeyForV1DocsDefinition(domain),
            Body: JSON.stringify(readDocsDefinition)
        });
        try {
            const response = await this.dbDocsDefinitionS3.send(command);
            return response;
        } catch (error) {
            this.app.logger.error(`Failed to write docs definition to S3 for domain ${domain}`, error);
            // Send a slack notification about the failure
            await this.app.services.slack.notify(`Fail to store docs for ${domain} in s3!`, error);

            throw error;
        }
    }

    async getPresignedDocsAssetsDownloadUrl({
        key,
        isPrivate
    }: {
        key: string;
        isPrivate: boolean;
    }): Promise<FdrAPI.Url> {
        if (isPrivate) {
            // presigned url for private
            const cachedUrl = this.presignedDownloadUrlCache.get(key);
            if (cachedUrl != null && typeof cachedUrl === "string") {
                return FdrAPI.Url(cachedUrl);
            }
            const command = new GetObjectCommand({
                Bucket: this.config.privateDocsS3.bucketName,
                Key: key
            });
            const signedUrl = await getSignedUrl(this.privateDocsS3, command, {
                expiresIn: 604800
            });
            this.presignedDownloadUrlCache.set(key, signedUrl);
            return FdrAPI.Url(signedUrl);
        }

        return FdrAPI.Url(`${this.publicDocsCDNUrl}/${key}`);
    }

    async checkFileExists({ key, isPrivate }: { key: string; isPrivate: boolean }): Promise<boolean> {
        const s3Client = isPrivate ? this.privateDocsS3 : this.publicDocsS3;
        const bucketName = isPrivate ? this.config.privateDocsS3.bucketName : this.config.publicDocsS3.bucketName;

        try {
            await s3Client.send(
                new HeadObjectCommand({
                    Bucket: bucketName,
                    Key: key
                })
            );
            return true;
        } catch (error) {
            // NotFound or 404 means file doesn't exist
            if (
                (error as { name?: string }).name === "NotFound" ||
                (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
            ) {
                return false;
            }
            // For other errors, log and assume file doesn't exist to be safe
            this.app.logger.warn(`Error checking file existence for key ${key}`, error);
            return false;
        }
    }

    async getPresignedDocsAssetsUploadUrls({
        domain,
        filepaths,
        images,
        isPrivate
    }: {
        domain: string;
        filepaths: DocsV2Write.FilePathInput[];
        images: DocsV2Write.ImageFilePath[];
        isPrivate: boolean;
    }): Promise<S3DocsUploadResult> {
        this.app.logger.debug(
            `[S3] getPresignedDocsAssetsUploadUrls: domain=${domain}, filepaths=${filepaths.length}, images=${images.length}, isPrivate=${isPrivate}`
        );
        const fileInfos: Record<DocsV1Write.FilePath, S3DocsFileInfo> = {};
        const skippedFiles: DocsV1Write.FilePath[] = [];
        const time: string = new Date().toISOString();

        for (const filepathInput of filepaths) {
            // Handle FilePathInput union type - can be string or object with hash
            let filepath: DocsV1Write.FilePath;
            let fileHash: string | undefined;

            if (typeof filepathInput === "string") {
                filepath = filepathInput;
                fileHash = undefined;
            } else {
                filepath = filepathInput.path;
                fileHash = filepathInput.fileHash;
            }

            // Check if file exists when hash is provided
            if (fileHash != null) {
                const key = this.constructS3DocsKeyWithHash({ domain, filepath, fileHash });
                const exists = await this.checkFileExists({ key, isPrivate });

                if (exists) {
                    // File already exists - mark as skipped but still generate presigned URL
                    // The presigned URL won't be used by the client but is needed for convertDocsDefinitionToDb
                    skippedFiles.push(filepath);
                    const { url } = await this.createPresignedDocsAssetsUploadUrlWithClient({
                        domain,
                        time,
                        filepath,
                        fileHash,
                        isPrivate
                    });
                    fileInfos[filepath] = {
                        presignedUrl: {
                            fileId: APIV1Write.FileId(uuidv4()),
                            uploadUrl: url
                        },
                        key,
                        imageMetadata: undefined
                    };
                    continue;
                }
            }

            // File doesn't exist or no hash - generate upload URL
            const { url, key } = await this.createPresignedDocsAssetsUploadUrlWithClient({
                domain,
                time,
                filepath,
                fileHash,
                isPrivate
            });
            fileInfos[filepath] = {
                presignedUrl: {
                    fileId: APIV1Write.FileId(uuidv4()),
                    uploadUrl: url
                },
                key,
                imageMetadata: undefined
            };
        }

        for (const image of images) {
            // Check if image exists when hash is provided
            if (image.fileHash != null) {
                const key = this.constructS3DocsKeyWithHash({
                    domain,
                    filepath: image.filePath,
                    fileHash: image.fileHash
                });
                const exists = await this.checkFileExists({ key, isPrivate });

                if (exists) {
                    // Image already exists - mark as skipped but still generate presigned URL
                    skippedFiles.push(image.filePath);
                    const { url } = await this.createPresignedDocsAssetsUploadUrlWithClient({
                        domain,
                        time,
                        filepath: image.filePath,
                        fileHash: image.fileHash,
                        isPrivate
                    });
                    fileInfos[image.filePath] = {
                        presignedUrl: {
                            fileId: APIV1Write.FileId(uuidv4()),
                            uploadUrl: url
                        },
                        key,
                        imageMetadata: {
                            width: image.width,
                            height: image.height,
                            blurDataUrl: image.blurDataUrl,
                            alt: image.alt
                        }
                    };
                    continue;
                }
            }

            // Image doesn't exist or no hash - generate upload URL
            const { url, key } = await this.createPresignedDocsAssetsUploadUrlWithClient({
                domain,
                time,
                filepath: image.filePath,
                fileHash: image.fileHash,
                isPrivate
            });
            fileInfos[image.filePath] = {
                presignedUrl: {
                    fileId: APIV1Write.FileId(uuidv4()),
                    uploadUrl: url
                },
                key,
                imageMetadata: {
                    width: image.width,
                    height: image.height,
                    blurDataUrl: image.blurDataUrl,
                    alt: image.alt
                }
            };
        }

        return { fileInfos, skippedFiles };
    }

    async createPresignedDocsAssetsUploadUrlWithClient({
        domain,
        time,
        filepath,
        fileHash,
        isPrivate
    }: {
        domain: string;
        time: string;
        filepath: DocsV1Write.FilePath;
        fileHash?: string;
        isPrivate: boolean;
    }): Promise<{ url: string; key: string }> {
        let key: string;
        if (fileHash != null) {
            // If hash is provided, use hash-based key (no timestamp)
            key = this.constructS3DocsKeyWithHash({ domain, filepath, fileHash });
        } else if (this.config.localModeOverride) {
            key = this.constructS3DocsKeyWithoutTime({ domain, filepath });
        } else {
            key = this.constructS3DocsKey({ domain, time, filepath });
        }
        const bucketName = isPrivate ? this.config.privateDocsS3.bucketName : this.config.publicDocsS3.bucketName;
        const input: PutObjectCommandInput = {
            Bucket: bucketName,
            Key: key,
            CacheControl: "public, max-age=31536000, immutable"
        };
        if (filepath.endsWith(".svg")) {
            input.ContentType = "image/svg+xml";
        }
        const command = new PutObjectCommand(input);
        this.app.logger.debug(`[S3] Creating presigned URL for bucket=${bucketName}, key=${key}`);
        const url = await getSignedUrl(isPrivate ? this.privateDocsS3 : this.publicDocsS3, command, {
            expiresIn: 3600
        });
        this.app.logger.debug(`[S3] Presigned URL created successfully`);
        return { url, key };
    }

    async getPresignedApiDefinitionSourceDownloadUrl({ key }: { key: string }): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.config.privateApiDefinitionSourceS3.bucketName,
            Key: key
        });
        return await getSignedUrl(this.privateDocsS3, command, {
            expiresIn: 604800
        });
    }

    async getPresignedApiDefinitionSourceUploadUrls({
        orgId,
        apiId,
        sources
    }: {
        orgId: FernRegistry.OrgId;
        apiId: FernRegistry.ApiId;
        sources: Record<APIV1Write.SourceId, APIV1Write.Source> | undefined;
    }): Promise<Record<APIV1Write.SourceId, S3ApiDefinitionSourceFileInfo>> {
        const result: Record<APIV1Write.SourceId, S3ApiDefinitionSourceFileInfo> = {};
        const time: string = new Date().toISOString();
        if (sources) {
            for (const [sourceId, _source] of Object.entries(sources)) {
                const { url, key } = await this.createPresignedApiDefinitionSourceUploadUrlWithClient({
                    orgId,
                    apiId,
                    time,
                    sourceId: APIV1Write.SourceId(sourceId)
                });
                result[APIV1Write.SourceId(sourceId)] = {
                    presignedUrl: url,
                    key
                };
            }
        }

        return result;
    }

    async getPresignedApiDefinitionDynamicIRsUploadUrls({
        orgId,
        apiId,
        dynamicIRs
    }: {
        orgId: FernRegistry.OrgId;
        apiId: APIV1Db.ApiDefinitionId;
        dynamicIRs: Record<string, DynamicIr> | undefined;
    }): Promise<Record<string, S3ApiDefinitionSourceFileInfo>> {
        const result: Record<string, S3ApiDefinitionSourceFileInfo> = {};

        if (dynamicIRs) {
            for (const [language, _dynamicIr] of Object.entries(dynamicIRs)) {
                const { url, key } = await this.createPresignedDynamicIrUrlWithClient({
                    orgId,
                    apiId,
                    language
                });
                result[language] = {
                    presignedUrl: url,
                    key
                };
            }
        }

        return result;
    }

    async getPresignedDynamicIrUploadUrlsForSdk({
        orgId,
        version,
        snippetConfiguration
    }: {
        orgId: FernRegistry.OrgId;
        version: string;
        snippetConfiguration: Record<string, string>;
    }): Promise<Record<string, S3ApiDefinitionSourceFileInfo>> {
        const result: Record<string, S3ApiDefinitionSourceFileInfo> = {};

        for (const [language, snippetName] of Object.entries(snippetConfiguration)) {
            const { url, key } = await this.createPresignedDynamicIrUrlForSdkWithClient({
                orgId,
                snippetName,
                version,
                language
            });
            result[language] = {
                presignedUrl: url,
                key
            };
        }

        return result;
    }

    async updateSdkDynamicIrLatestPointer({
        orgId,
        version,
        snippetConfiguration
    }: {
        orgId: FernRegistry.OrgId;
        version: string;
        snippetConfiguration: Record<string, string>;
    }): Promise<void> {
        const bucketName = this.config.privateApiDefinitionSourceS3.bucketName;

        for (const [language, snippetName] of Object.entries(snippetConfiguration)) {
            const pointerKey = this.constructS3DynamicIrLatestPointerKey({
                orgId,
                snippetName,
                language
            });

            try {
                // Write the version string to the "latest" pointer file
                const putCommand = new PutObjectCommand({
                    Bucket: bucketName,
                    Key: pointerKey,
                    Body: version,
                    ContentType: "text/plain"
                });
                await this.privateApiDefinitionSourceS3.send(putCommand);
            } catch (error) {
                this.app.logger.warn(
                    `Failed to update SDK dynamic IR latest pointer for ${language}: ${pointerKey}`,
                    error
                );
            }
        }
    }

    async checkSdkDynamicIrExists({
        orgId,
        snippetConfiguration
    }: {
        orgId: FernRegistry.OrgId;
        snippetConfiguration: Record<string, { packageName: string; version?: string }>;
    }): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        const bucketName = this.config.privateApiDefinitionSourceS3.bucketName;

        for (const [language, snippetInfo] of Object.entries(snippetConfiguration)) {
            let version = snippetInfo.version;

            // If no version specified, read the "latest" pointer to get the version
            if (version == null) {
                const pointerKey = this.constructS3DynamicIrLatestPointerKey({
                    orgId,
                    snippetName: snippetInfo.packageName,
                    language
                });

                try {
                    const getCommand = new GetObjectCommand({
                        Bucket: bucketName,
                        Key: pointerKey
                    });
                    const response = await this.privateApiDefinitionSourceS3.send(getCommand);
                    const body = await response.Body?.transformToString();
                    if (body) {
                        version = body.trim();
                    }
                } catch (error) {
                    // Pointer doesn't exist - no latest version available
                    if (
                        (error as { name?: string }).name === "NoSuchKey" ||
                        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
                    ) {
                        continue;
                    }
                    this.app.logger.warn(
                        `Error reading SDK dynamic IR latest pointer for ${language}: ${pointerKey}`,
                        error
                    );
                    continue;
                }
            }

            if (version == null) {
                continue;
            }

            const key = this.constructS3DynamicIrKeyForSdk({
                orgId,
                snippetName: snippetInfo.packageName,
                version,
                language
            });

            try {
                await this.privateApiDefinitionSourceS3.send(
                    new HeadObjectCommand({
                        Bucket: bucketName,
                        Key: key
                    })
                );

                // File exists, generate a presigned download URL
                const command = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: key
                });
                const downloadUrl = await getSignedUrl(this.privateApiDefinitionSourceS3, command, {
                    expiresIn: 3600
                });
                result[language] = downloadUrl;
            } catch (error) {
                // File doesn't exist or other error - skip this language
                if (
                    (error as { name?: string }).name === "NoSuchKey" ||
                    (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
                ) {
                    // File doesn't exist, which is expected - just skip
                    continue;
                }
                // Log other errors but don't fail
                this.app.logger.warn(`Error checking SDK dynamic IR existence for ${language}: ${key}`, error);
            }
        }

        return result;
    }

    async createPresignedApiDefinitionSourceUploadUrlWithClient({
        orgId,
        apiId,
        time,
        sourceId
    }: {
        orgId: FernRegistry.OrgId;
        apiId: FernRegistry.ApiId;
        time: string;
        sourceId: APIV1Write.SourceId;
    }): Promise<{ url: string; key: string }> {
        let key: string;
        if (this.config.localModeOverride) {
            key = this.constructS3ApiDefinitionSourceKeyWithoutTime({
                orgId,
                apiId,
                sourceId
            });
        } else {
            key = this.constructS3ApiDefinitionSourceKey({
                orgId,
                apiId,
                time,
                sourceId
            });
        }
        const bucketName = this.config.privateApiDefinitionSourceS3.bucketName;
        const input: PutObjectCommandInput = {
            Bucket: bucketName,
            Key: key
        };
        const command = new PutObjectCommand(input);
        return {
            url: await getSignedUrl(this.privateApiDefinitionSourceS3, command, {
                expiresIn: 3600
            }),
            key
        };
    }

    async createPresignedDynamicIrUrlWithClient({
        orgId,
        apiId,
        language
    }: {
        orgId: FernRegistry.OrgId;
        apiId: APIV1Db.ApiDefinitionId;
        language: string;
    }): Promise<{ url: string; key: string }> {
        const key = this.constructS3DynamicIrKey({
            orgId,
            apiId,
            language
        });

        // store the dynamic ir alongside corresponding api definitions
        const bucketName = this.config.privateApiDefinitionSourceS3.bucketName;
        const input: PutObjectCommandInput = {
            Bucket: bucketName,
            Key: key
        };
        const command = new PutObjectCommand(input);
        return {
            url: await getSignedUrl(this.privateApiDefinitionSourceS3, command, {
                expiresIn: 3600
            }),
            key
        };
    }

    async createPresignedDynamicIrUrlForSdkWithClient({
        orgId,
        snippetName,
        version,
        language
    }: {
        orgId: FernRegistry.OrgId;
        snippetName: string;
        version: string;
        language: string;
    }): Promise<{ url: string; key: string }> {
        const key = this.constructS3DynamicIrKeyForSdk({
            orgId,
            snippetName,
            version,
            language
        });

        // store the dynamic ir for SDK generation
        const bucketName = this.config.privateApiDefinitionSourceS3.bucketName;
        const input: PutObjectCommandInput = {
            Bucket: bucketName,
            Key: key
        };
        const command = new PutObjectCommand(input);
        return {
            url: await getSignedUrl(this.privateApiDefinitionSourceS3, command, {
                expiresIn: 3600
            }),
            key
        };
    }

    async deleteDocsAssetsByDomain({ domain }: { domain: string }): Promise<{ deletedCount: number }> {
        let totalDeleted = 0;
        const prefix = `${domain}/`;

        // Delete from public docs bucket
        totalDeleted += await this.deleteObjectsByPrefix({
            s3Client: this.publicDocsS3,
            bucketName: this.config.publicDocsS3.bucketName,
            prefix
        });

        // Delete from private docs bucket
        totalDeleted += await this.deleteObjectsByPrefix({
            s3Client: this.privateDocsS3,
            bucketName: this.config.privateDocsS3.bucketName,
            prefix
        });

        // Delete from docs definition bucket
        totalDeleted += await this.deleteObjectsByPrefix({
            s3Client: this.dbDocsDefinitionS3,
            bucketName: this.config.dbDocsDefinitionS3.bucketName,
            prefix
        });

        return { deletedCount: totalDeleted };
    }

    private async deleteObjectsByPrefix({
        s3Client,
        bucketName,
        prefix
    }: {
        s3Client: S3Client;
        bucketName: string;
        prefix: string;
    }): Promise<number> {
        let totalDeleted = 0;
        let continuationToken: string | undefined;

        do {
            // List objects with the given prefix
            const listResponse = await s3Client.send(
                new ListObjectsV2Command({
                    Bucket: bucketName,
                    Prefix: prefix,
                    ContinuationToken: continuationToken
                })
            );

            const objects = listResponse.Contents;
            if (objects == null || objects.length === 0) {
                break;
            }

            // Delete objects in batches of up to 1000
            const keysToDelete = objects.map((obj) => ({ Key: obj.Key })).filter((obj) => obj.Key != null);

            if (keysToDelete.length > 0) {
                await s3Client.send(
                    new DeleteObjectsCommand({
                        Bucket: bucketName,
                        Delete: {
                            Objects: keysToDelete,
                            Quiet: true
                        }
                    })
                );
                totalDeleted += keysToDelete.length;
            }

            continuationToken = listResponse.NextContinuationToken;
        } while (continuationToken != null);

        return totalDeleted;
    }

    constructS3DocsKey({
        domain,
        time,
        filepath
    }: {
        domain: string;
        time: string;
        filepath: DocsV1Write.FilePath;
    }): string {
        return `${domain}/${time}/${filepath}`;
    }

    constructS3DocsKeyWithoutTime({ domain, filepath }: { domain: string; filepath: DocsV1Write.FilePath }): string {
        // In self-hosted mode, bucket already represents the domain, so don't duplicate
        return this.config.localModeOverride ? filepath : `${domain}/${filepath}`;
    }

    constructS3DocsKeyWithHash({
        domain,
        filepath,
        fileHash
    }: {
        domain: string;
        filepath: DocsV1Write.FilePath;
        fileHash: string;
    }): string {
        // Use hash-based key for content-addressed storage and deduplication
        // Format: domain/hash/filepath
        return `${domain}/${fileHash}/${filepath}`;
    }

    constructS3DynamicIrKey({
        orgId,
        apiId,
        language
    }: {
        orgId: FernRegistry.OrgId;
        apiId: APIV1Db.ApiDefinitionId;
        language: string;
    }): string {
        return `${orgId}/${apiId}/${language}.json`;
    }

    constructS3DynamicIrKeyForSdk({
        orgId,
        snippetName,
        version,
        language
    }: {
        orgId: FernRegistry.OrgId;
        snippetName: string;
        version: string;
        language: string;
    }): string {
        // Format: <org-name>/<language>/<snippet-name>/<version>.json
        return `${orgId}/${language}/${snippetName}/${version}.json`;
    }

    constructS3DynamicIrLatestPointerKey({
        orgId,
        snippetName,
        language
    }: {
        orgId: FernRegistry.OrgId;
        snippetName: string;
        language: string;
    }): string {
        // Format: <org-name>/<language>/<snippet-name>/latest
        // This file contains the version string (e.g., "1.0.0")
        return `${orgId}/${language}/${snippetName}/latest`;
    }

    constructS3ApiDefinitionSourceKey({
        orgId,
        apiId,
        time,
        sourceId
    }: {
        orgId: FernRegistry.OrgId;
        apiId: FernRegistry.ApiId;
        time: string;
        sourceId: APIV1Write.SourceId;
    }): string {
        return `${orgId}/${apiId}/${time}/${sourceId}`;
    }

    constructS3ApiDefinitionSourceKeyWithoutTime({
        orgId,
        apiId,
        sourceId
    }: {
        orgId: FernRegistry.OrgId;
        apiId: FernRegistry.ApiId;
        sourceId: APIV1Write.SourceId;
    }): string {
        return `${orgId}/${apiId}/${sourceId}`;
    }
}
