import { v4 as uuidv4 } from "uuid";
import type { FernRegistry } from "../../api/generated";
import { LibraryDocsJobId } from "../../api/generated/api/resources/docs/resources/v2/resources/write/types/LibraryDocsJobId";
import type { FdrApplication } from "../../app";
import { parseErrorFromDb } from "../../db/library-docs/LibraryDocsDao";
import { MarkdownGeneratorStub } from "./generators/MarkdownGenerator";
import { NavigationBuilder } from "./generators/NavigationBuilder";
import { PythonParserStub } from "./parsers/PythonParser";
import { ResultStorage, type StoredResult } from "./ResultStorage";

export interface StartGenerationParams {
    orgId: string;
    githubUrl: string;
    language: FernRegistry.docs.v2.write.LibraryLanguage;
    config?: FernRegistry.docs.v2.write.LibraryDocsConfig;
}

export interface LibraryDocsService {
    startGeneration(params: StartGenerationParams): Promise<string>;
    getStatus(jobId: string): Promise<FernRegistry.docs.v2.write.LibraryDocsGenerationStatus | null>;
    getResult(jobId: string): Promise<FernRegistry.docs.v2.write.LibraryDocsResult | null>;
}

export class LibraryDocsServiceImpl implements LibraryDocsService {
    private resultStorage: ResultStorage;
    private parser: PythonParserStub;
    private markdownGenerator: MarkdownGeneratorStub;
    private navigationBuilder: NavigationBuilder;

    constructor(private readonly app: FdrApplication) {
        this.resultStorage = new ResultStorage(app.config);
        this.parser = new PythonParserStub();
        this.markdownGenerator = new MarkdownGeneratorStub();
        this.navigationBuilder = new NavigationBuilder();
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

    async getStatus(jobId: string): Promise<FernRegistry.docs.v2.write.LibraryDocsGenerationStatus | null> {
        const generation = await this.app.dao.libraryDocs().getGeneration(jobId);
        if (generation == null) {
            return null;
        }

        const error = parseErrorFromDb(generation.error);

        return {
            jobId: LibraryDocsJobId(jobId),
            status: generation.status as FernRegistry.docs.v2.write.LibraryDocsGenerationStatusType,
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

    async getResult(jobId: string): Promise<FernRegistry.docs.v2.write.LibraryDocsResult | null> {
        const generation = await this.app.dao.libraryDocs().getGeneration(jobId);
        if (generation == null) {
            return null;
        }

        if (generation.status !== "COMPLETED" || generation.resultS3Key == null) {
            return null;
        }

        const resultUrl = await this.resultStorage.getPresignedDownloadUrl(generation.resultS3Key);

        return {
            jobId: LibraryDocsJobId(jobId),
            resultUrl
        };
    }

    private async processJobAsync(jobId: string, params: StartGenerationParams): Promise<void> {
        const dao = this.app.dao.libraryDocs();

        try {
            await dao.updateStatus(jobId, "CLONING");
            // Stub: skip actual cloning
            const repoPath = `/tmp/stub-repo-${jobId}`;

            await dao.updateStatus(jobId, "PARSING");
            const libraryDef = await this.parser.parse(repoPath, {
                githubUrl: params.githubUrl,
                packagePath: params.config?.packagePath
            });

            await dao.updateStatus(jobId, "GENERATING");
            const baseSlug = params.config?.slug ?? "library-reference";
            const pages = this.markdownGenerator.generateFromLibrary(libraryDef, baseSlug);
            const navigation = this.navigationBuilder.buildNavigation(libraryDef, pages, {
                title: params.config?.title ?? "Library Reference",
                slug: baseSlug
            });

            // Convert to storage format
            const pagesMap: Record<string, string> = {};
            for (const page of pages) {
                pagesMap[page.pageId] = page.content;
            }

            const storedResult: StoredResult = {
                jobId,
                pages: pagesMap,
                navigation,
                metadata: {
                    sourceUrl: params.githubUrl,
                    branch: params.config?.branch,
                    parsedAt: libraryDef.metadata.parsedAt.toISOString(),
                    parserVersion: libraryDef.metadata.parserVersion
                }
            };

            // TODO: (future optimization: to break up the upload into multiple parts if result is too large)
            const s3Key = await this.resultStorage.upload(storedResult);
            await dao.setResultS3Key(jobId, s3Key);

            this.app.logger.info(`Library docs generation completed for job ${jobId}`);
        } catch (error) {
            this.app.logger.error(`Library docs generation failed for job ${jobId}:`, error);
            await dao.saveError(jobId, {
                code: "GENERATION_FAILED",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    }

    private getProgressMessage(status: string): string {
        switch (status) {
            case "PENDING":
                return "Queued for processing";
            case "CLONING":
                return "Cloning repository...";
            case "PARSING":
                return "Parsing library code...";
            case "GENERATING":
                return "Generating documentation...";
            case "COMPLETED":
                return "Documentation generated successfully";
            case "FAILED":
                return "Generation failed";
            default:
                return "Processing...";
        }
    }
}
