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
    doxyfileContent?: string;
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
    private pythonLambdaInvoker: LambdaInvoker | undefined;
    private cppLambdaInvoker: LambdaInvoker | undefined;

    constructor(private readonly app: FdrApplication) {
        this.resultStorage = new ResultStorage(app.config);

        const pythonLambdaConfig = app.config.pythonLibraryDocsLambda;
        if (pythonLambdaConfig != null) {
            this.pythonLambdaInvoker = new LambdaInvoker(pythonLambdaConfig);
        }

        const cppLambdaConfig = app.config.cppLibraryDocsLambda;
        if (cppLambdaConfig != null) {
            this.cppLambdaInvoker = new LambdaInvoker(cppLambdaConfig);
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
            let lambdaInvoker: LambdaInvoker | undefined;
            switch (params.language) {
                case "PYTHON":
                    lambdaInvoker = this.pythonLambdaInvoker;
                    if (lambdaInvoker == null) {
                        throw new Error("Python library docs Lambda is not configured");
                    }
                    break;
                case "CPP":
                    lambdaInvoker = this.cppLambdaInvoker;
                    if (lambdaInvoker == null) {
                        throw new Error("C++ library docs Lambda is not configured");
                    }
                    break;
                default:
                    throw new Error(`Unsupported language: ${params.language}`);
            }

            await dao.updateStatus(jobId, "PARSING");

            // Invoke Lambda to parse library and upload IR to S3
            const lambdaResult = await lambdaInvoker.invoke({
                jobId,
                githubUrl: params.githubUrl,
                language: params.language,
                branch: params.config?.branch,
                packagePath: params.config?.packagePath,
                doxyfileContent: params.doxyfileContent
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
