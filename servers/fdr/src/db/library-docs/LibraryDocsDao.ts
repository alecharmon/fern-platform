import type {
    LibraryDocsGeneration,
    PrismaClient,
    LibraryDocsLanguage as PrismaLanguage,
    LibraryDocsGenerationStatus as PrismaStatus
} from "@prisma/client";
import { readBuffer, writeBuffer } from "../../util";

export interface CreateGenerationParams {
    id: string;
    orgId: string;
    githubUrl: string;
    language: string;
    branch?: string;
    packagePath?: string;
}

export interface GenerationError {
    code: string;
    message: string;
}

export interface LibraryDocsDao {
    createGeneration(params: CreateGenerationParams): Promise<string>;
    getGeneration(id: string): Promise<LibraryDocsGeneration | null>;
    getOrgIdForJob(id: string): Promise<string | null>;
    updateStatus(id: string, status: string): Promise<void>;
    setIrS3Key(id: string, s3Key: string): Promise<void>;
    saveError(id: string, error: GenerationError): Promise<void>;
}

export function parseErrorFromDb(errorBytes: Buffer | null): GenerationError | undefined {
    if (errorBytes == null) {
        return undefined;
    }
    return readBuffer(errorBytes) as GenerationError;
}

export class LibraryDocsDaoImpl implements LibraryDocsDao {
    constructor(private readonly prisma: PrismaClient) {}

    async createGeneration(params: CreateGenerationParams): Promise<string> {
        await this.prisma.libraryDocsGeneration.create({
            data: {
                id: params.id,
                orgId: params.orgId,
                githubUrl: params.githubUrl,
                language: params.language as PrismaLanguage,
                branch: params.branch,
                packagePath: params.packagePath,
                status: "PENDING"
            }
        });
        return params.id;
    }

    async getGeneration(id: string): Promise<LibraryDocsGeneration | null> {
        return this.prisma.libraryDocsGeneration.findUnique({
            where: { id }
        });
    }

    async getOrgIdForJob(id: string): Promise<string | null> {
        const result = await this.prisma.libraryDocsGeneration.findUnique({
            where: { id },
            select: { orgId: true }
        });
        return result?.orgId ?? null;
    }

    async updateStatus(id: string, status: string): Promise<void> {
        await this.prisma.libraryDocsGeneration.update({
            where: { id },
            data: { status: status as PrismaStatus }
        });
    }

    async setIrS3Key(id: string, s3Key: string): Promise<void> {
        await this.prisma.libraryDocsGeneration.update({
            where: { id },
            data: { irS3Key: s3Key }
        });
    }

    async saveError(id: string, error: GenerationError): Promise<void> {
        await this.prisma.libraryDocsGeneration.update({
            where: { id },
            data: { error: writeBuffer(error) }
        });
    }
}
