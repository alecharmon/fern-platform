import {
    GetLibraryDocsStatusInputSchema,
    LibraryDocsResultSchema,
    StartLibraryDocsGenerationInputSchema,
    StartLibraryDocsGenerationResponseSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";

import type { FdrApplication } from "../../../app";

export function createLibraryDocsRouter(app: FdrApplication) {
    const startLibraryDocsGeneration = os
        .route({ method: "POST", path: "/library-docs/generate" })
        .input(StartLibraryDocsGenerationInputSchema)
        .output(StartLibraryDocsGenerationResponseSchema)
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
                              branch: input.config.branch ?? undefined,
                              packagePath: input.config.packagePath ?? undefined
                          }
                        : undefined
            });

            return { jobId };
        });

    const getLibraryDocsGenerationStatus = os
        .route({ method: "GET", path: "/library-docs/status/{jobId}" })
        .input(GetLibraryDocsStatusInputSchema)
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
        .input(GetLibraryDocsStatusInputSchema)
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
