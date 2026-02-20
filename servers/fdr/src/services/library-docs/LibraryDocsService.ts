import { v4 as uuidv4 } from "uuid";
import type { FdrApplication } from "../../app";
import { parseErrorFromDb } from "../../db/library-docs/LibraryDocsDao";
import { LambdaInvoker } from "./LambdaInvoker";
import { ResultStorage } from "./ResultStorage";

export interface StartGenerationParams {
    orgId: string;
    githubUrl: string;
    language: string;
    config?: { branch?: string; packagePath?: string };
}

export interface LibraryDocsGenerationStatus {
    jobId: string;
    status: string;
    progress: string;
    error?: { code: string; message: string };
    createdAt: string;
    updatedAt: string;
}

export interface LibraryDocsResult {
    jobId: string;
    resultUrl: string;
}

export interface LibraryDocsService {
    startGeneration(params: StartGenerationParams): Promise<string>;
    getStatus(jobId: string): Promise<LibraryDocsGenerationStatus | null>;
    getResult(jobId: string): Promise<LibraryDocsResult | null>;
}

export class LibraryDocsServiceImpl implements LibraryDocsService {
    private resultStorage: ResultStorage;
    private lambdaInvoker: LambdaInvoker | undefined;

    constructor(private readonly app: FdrApplication) {
        this.resultStorage = new ResultStorage(app.config);

        const lambdaConfig = app.config.pythonLibraryDocsLambda;
        if (lambdaConfig != null) {
            this.lambdaInvoker = new LambdaInvoker(lambdaConfig);
        }
    }

    async startGeneration(params: StartGenerationParams): Promise<string> {
        const jobId = `libdocs_${uuidv4()}`;

        await this.app.dao.libraryDocs().createGeneration({
            id: jobId,
            orgId: params.orgId,
            githubUrl: params.githubUrl,
            language: params.language,
            branch: params.config?.branch,
            packagePath: params.config?.packagePath
        });

        // Start async processing in background
        this.processJobAsync(jobId, params).catch((error) => {
            this.app.logger.error(`Error processing library docs job ${jobId}:`, error);
        });

        return jobId;
    }

    async getStatus(jobId: string): Promise<LibraryDocsGenerationStatus | null> {
        const generation = await this.app.dao.libraryDocs().getGeneration(jobId);
        if (generation == null) {
            return null;
        }

        const error = parseErrorFromDb(generation.error);

        return {
            jobId,
            status: generation.status,
            progress: this.getProgressMessage(generation.status),
            error:
                error != null
                    ? {
                          code: error.code,
                          message: error.message
                      }
                    : undefined,
            createdAt: generation.createdAt.toISOString(),
            updatedAt: generation.updatedAt.toISOString()
        };
    }

    async getResult(jobId: string): Promise<LibraryDocsResult | null> {
        const generation = await this.app.dao.libraryDocs().getGeneration(jobId);
        if (generation == null) {
            return null;
        }

        if (generation.status !== "COMPLETED" || generation.irS3Key == null) {
            return null;
        }

        const resultUrl = await this.resultStorage.getPresignedDownloadUrl(generation.irS3Key);

        return {
            jobId,
            resultUrl
        };
    }

    private async processJobAsync(jobId: string, params: StartGenerationParams): Promise<void> {
        const dao = this.app.dao.libraryDocs();

        try {
            if (this.lambdaInvoker == null) {
                throw new Error("Python library docs Lambda is not configured");
            }

            await dao.updateStatus(jobId, "PARSING");

            // Invoke Lambda to parse library and upload IR to S3
            const lambdaResult = await this.lambdaInvoker.invoke({
                jobId,
                githubUrl: params.githubUrl,
                language: params.language,
                branch: params.config?.branch,
                packagePath: params.config?.packagePath
            });

            if (lambdaResult.status === "error") {
                await dao.saveError(jobId, lambdaResult.error ?? { code: "LAMBDA_ERROR", message: "Unknown error" });
                await dao.updateStatus(jobId, "FAILED");
                return;
            }

            if (lambdaResult.irS3Key == null) {
                await dao.saveError(jobId, { code: "LAMBDA_NO_IR", message: "Lambda did not return IR S3 key" });
                await dao.updateStatus(jobId, "FAILED");
                return;
            }

            // Store IR S3 key - markdown generation will happen during docs registration
            await dao.setIrS3Key(jobId, lambdaResult.irS3Key);
            await dao.updateStatus(jobId, "COMPLETED");

            this.app.logger.info(`Library docs IR stored for job ${jobId}`);
        } catch (error) {
            this.app.logger.error(`Library docs generation failed for job ${jobId}:`, error);
            await dao.saveError(jobId, {
                code: "GENERATION_FAILED",
                message: error instanceof Error ? error.message : "Unknown error"
            });
            await dao.updateStatus(jobId, "FAILED");
        }
    }

    private getProgressMessage(status: string): string {
        switch (status) {
            case "PENDING":
                return "Queued for processing";
            case "PARSING":
                return "Parsing library code...";
            case "COMPLETED":
                return "Library IR generated successfully";
            case "FAILED":
                return "Generation failed";
            default:
                return "Processing...";
        }
    }
}
