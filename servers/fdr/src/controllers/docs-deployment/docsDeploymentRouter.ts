import type {
    CreateDeploymentInputSchema,
    CreateDeploymentResponseSchema,
    DocsSiteSchema,
    GetDocsDeploymentsInputSchema,
    GetDocsDeploymentsResponseSchema,
    GetDocsStatusInputSchema,
    GetDocsStatusResponseSchema,
    GetPostmanCollectionIdInputSchema,
    GetPostmanCollectionIdResponseSchema,
    RegisterDocsSiteInputSchema,
    SetDocsStatusInputSchema,
    UpdateDeploymentStatusInputSchema,
    UpdateDeploymentStatusResponseSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import type { Prisma } from "@prisma/client";
import * as z from "zod";
import type { FdrApplication } from "../../app";

interface HandlerContext {
    headers: Record<string, string | undefined>;
}

// ORPC types context as Record<never, never>, so we accept object and assert to HandlerContext
function getAuthorization(context: object): string | undefined {
    return (context as HandlerContext).headers.authorization;
}

export function createDocsDeploymentRouter(app: FdrApplication) {
    const registerDocsSite = os
        .route({ method: "POST", path: "/register" })
        .input(z.custom<z.infer<typeof RegisterDocsSiteInputSchema>>())
        .output(z.custom<z.infer<typeof DocsSiteSchema>>())
        .handler(async ({ input, context }) => {
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: getAuthorization(context),
                orgId: input.orgId
            });

            const site = await app.dao.docsSite().registerDocsSite({
                domain: input.domain,
                orgId: input.orgId,
                basepath: input.basepath ?? undefined,
                previewUrl: input.previewUrl ?? undefined,
                postmanCollectionId: input.postmanCollectionId ?? undefined
            });

            return {
                id: site.id,
                orgId: site.orgId,
                domain: site.domain,
                basepath: site.basepath ?? undefined,
                previewUrl: site.previewUrl ?? undefined,
                postmanCollectionId: site.postmanCollectionId ?? undefined,
                status: site.status,
                createdAt: site.createdAt.toISOString(),
                updatedAt: site.updatedAt.toISOString()
            };
        });

    const getDocsStatus = os
        .route({ method: "GET", path: "/status" })
        .input(z.custom<z.infer<typeof GetDocsStatusInputSchema>>())
        .output(z.custom<z.infer<typeof GetDocsStatusResponseSchema>>())
        .handler(async ({ input, context }) => {
            const authHeader = getAuthorization(context);
            if (authHeader == null) {
                throw new ORPCError("UNAUTHORIZED", { message: "Authorization header was not specified" });
            }

            const status = await app.dao.docsSite().getDocsStatus(input.domain, input.basepath ?? undefined);
            return { status };
        });

    const setDocsStatus = os
        .route({ method: "PUT", path: "/status" })
        .input(z.custom<z.infer<typeof SetDocsStatusInputSchema>>())
        .output(z.custom<z.infer<typeof DocsSiteSchema>>())
        .handler(async ({ input, context }) => {
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: getAuthorization(context),
                orgId: input.orgId
            });

            const site = await app.dao
                .docsSite()
                .setDocsStatus(input.domain, input.orgId, input.basepath ?? undefined, input.status);

            return {
                id: site.id,
                orgId: site.orgId,
                domain: site.domain,
                basepath: site.basepath ?? undefined,
                previewUrl: site.previewUrl ?? undefined,
                postmanCollectionId: site.postmanCollectionId ?? undefined,
                status: site.status,
                createdAt: site.createdAt.toISOString(),
                updatedAt: site.updatedAt.toISOString()
            };
        });

    const createDeployment = os
        .route({ method: "POST", path: "/deployment" })
        .input(z.custom<z.infer<typeof CreateDeploymentInputSchema>>())
        .output(z.custom<z.infer<typeof CreateDeploymentResponseSchema>>())
        .handler(async ({ input, context }) => {
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: getAuthorization(context),
                orgId: input.orgId
            });

            const deploymentId = await app.dao.docsSite().createDeployment({
                domain: input.domain,
                orgId: input.orgId,
                userId: input.userId ?? undefined,
                basepath: input.basepath ?? undefined,
                previewUrl: input.previewUrl ?? undefined,
                metadata: input.metadata as Prisma.InputJsonValue | undefined
            });
            return { deploymentId };
        });

    const updateDeploymentStatus = os
        .route({ method: "PATCH", path: "/deployment/{deploymentId}" })
        .input(z.custom<z.infer<typeof UpdateDeploymentStatusInputSchema>>())
        .output(z.custom<z.infer<typeof UpdateDeploymentStatusResponseSchema>>())
        .handler(async ({ input, context }) => {
            const orgId = await app.dao.docsSite().getDeploymentOrgId(input.deploymentId);
            if (orgId == null) {
                throw new ORPCError("NOT_FOUND", { message: "Deployment not found" });
            }
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: getAuthorization(context),
                orgId
            });

            await app.dao
                .docsSite()
                .updateDeploymentStatus(input.deploymentId, input.status, input.updatedBy ?? undefined);
            return { success: true };
        });

    const getDocsDeployments = os
        .route({ method: "GET", path: "/deployments" })
        .input(z.custom<z.infer<typeof GetDocsDeploymentsInputSchema>>())
        .output(z.custom<z.infer<typeof GetDocsDeploymentsResponseSchema>>())
        .handler(async ({ input, context }) => {
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: getAuthorization(context),
                orgId: input.orgId
            });

            let limit: number | undefined;
            if (input.limit != null) {
                const parsed = Number(input.limit);
                if (Number.isFinite(parsed)) {
                    limit = Math.max(1, Math.min(100, Math.trunc(parsed)));
                }
            }

            const deployments = await app.dao.docsSite().getDocsDeployments({
                domain: input.domain,
                orgId: input.orgId,
                basepath: input.basepath ?? undefined,
                limit
            });

            return {
                deployments: deployments.map((d) => ({
                    id: d.id,
                    orgId: d.orgId,
                    domain: d.domain,
                    basepath: d.basepath ?? undefined,
                    createdAt: d.createdAt.toISOString(),
                    createdBy: d.createdBy ?? undefined,
                    status: d.status,
                    updatedAt: d.updatedAt.toISOString(),
                    updatedBy: d.updatedBy ?? undefined,
                    previewUrl: d.previewUrl ?? undefined,
                    metadata:
                        d.metadata != null && typeof d.metadata === "object" && !Array.isArray(d.metadata)
                            ? (d.metadata as Record<string, unknown>)
                            : undefined
                }))
            };
        });

    const getPostmanCollectionId = os
        .route({ method: "GET", path: "/postman-collection-id" })
        .input(z.custom<z.infer<typeof GetPostmanCollectionIdInputSchema>>())
        .output(z.custom<z.infer<typeof GetPostmanCollectionIdResponseSchema>>())
        .handler(async ({ input, context }) => {
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: getAuthorization(context),
                orgId: input.orgId
            });

            const postmanCollectionId = await app.dao
                .docsSite()
                .getPostmanCollectionId(input.orgId, input.domain, input.basepath ?? undefined);
            return { postmanCollectionId };
        });

    return {
        registerDocsSite,
        getDocsStatus,
        setDocsStatus,
        createDeployment,
        updateDeploymentStatus,
        getDocsDeployments,
        getPostmanCollectionId
    };
}
