import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../../app";

const LibraryDocsConfigSchema = z.object({
    branch: z.string().optional(),
    packagePath: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional()
});

const LibraryDocsGenerationErrorSchema = z.object({
    code: z.string(),
    message: z.string()
});

const LibraryDocsGenerationStatusSchema = z.object({
    jobId: z.string(),
    status: z.enum(["PENDING", "PARSING", "COMPLETED", "FAILED"]),
    progress: z.string().optional(),
    error: LibraryDocsGenerationErrorSchema.optional(),
    createdAt: z.string(),
    updatedAt: z.string()
});

const LibraryDocsResultSchema = z.object({
    jobId: z.string(),
    resultUrl: z.string()
});

export function createLibraryDocsRouter(app: FdrApplication) {
    const startLibraryDocsGeneration = os
        .route({ method: "POST", path: "/library-docs/generate" })
        .input(
            z.object({
                orgId: z.string(),
                githubUrl: z.string(),
                language: z.enum(["PYTHON", "CPP"]),
                config: LibraryDocsConfigSchema.optional()
            })
        )
        .output(z.object({ jobId: z.string() }))
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: input.orgId
            });

            if (input.language !== "PYTHON") {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Language ${input.language} is not yet implemented. Currently supported: PYTHON`
                });
            }

            const jobId = await app.services.libraryDocs.startGeneration({
                orgId: input.orgId,
                githubUrl: input.githubUrl,
                language: input.language,
                config:
                    input.config != null
                        ? {
                              branch: input.config.branch,
                              packagePath: input.config.packagePath,
                              title: input.config.title,
                              slug: input.config.slug
                          }
                        : undefined
            });

            return { jobId };
        });

    const getLibraryDocsGenerationStatus = os
        .route({ method: "GET", path: "/library-docs/status/{jobId}" })
        .input(z.object({ jobId: z.string() }))
        .output(LibraryDocsGenerationStatusSchema)
        .handler(async ({ input }) => {
            const { jobId } = input;
            const status = await app.services.libraryDocs.getStatus(jobId);

            if (status == null) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Library docs job not found"
                });
            }

            return status;
        });

    const getLibraryDocsResult = os
        .route({ method: "GET", path: "/library-docs/result/{jobId}" })
        .input(z.object({ jobId: z.string() }))
        .output(LibraryDocsResultSchema)
        .handler(async ({ input }) => {
            const { jobId } = input;
            const status = await app.services.libraryDocs.getStatus(jobId);

            if (status == null) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Library docs job not found"
                });
            }

            if (status.status !== "COMPLETED") {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Job ${jobId} is not complete. Current status: ${status.status}`
                });
            }

            const result = await app.services.libraryDocs.getResult(jobId);
            if (result == null) {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Result not available for job ${jobId}`
                });
            }

            return result;
        });

    return { startLibraryDocsGeneration, getLibraryDocsGenerationStatus, getLibraryDocsResult };
}
