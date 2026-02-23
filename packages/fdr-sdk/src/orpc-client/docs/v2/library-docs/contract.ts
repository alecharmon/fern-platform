import { oc } from "@orpc/contract";
import * as z from "zod";

export const LibraryDocsConfigSchema = z.object({
    branch: z.string().nullish(),
    packagePath: z.string().nullish(),
    title: z.string().nullish(),
    slug: z.string().nullish()
});

export const StartLibraryDocsGenerationInputSchema = z.object({
    orgId: z.string(),
    githubUrl: z.string(),
    language: z.enum(["PYTHON", "CPP"]),
    config: LibraryDocsConfigSchema.nullish()
});

export const StartLibraryDocsGenerationResponseSchema = z.object({
    jobId: z.string()
});

export const GetLibraryDocsStatusInputSchema = z.object({
    jobId: z.string()
});

export const LibraryDocsResultSchema = z.object({
    jobId: z.string(),
    resultUrl: z.string()
});

export const libraryDocsContract = {
    startLibraryDocsGeneration: oc
        .route({ method: "POST", path: "/library-docs/generate" })
        .input(StartLibraryDocsGenerationInputSchema)
        .output(StartLibraryDocsGenerationResponseSchema),

    getLibraryDocsGenerationStatus: oc
        .route({ method: "GET", path: "/library-docs/status/{jobId}" })
        .input(GetLibraryDocsStatusInputSchema)
        .output(z.any()),

    getLibraryDocsResult: oc
        .route({ method: "GET", path: "/library-docs/result/{jobId}" })
        .input(GetLibraryDocsStatusInputSchema)
        .output(LibraryDocsResultSchema)
};
