import {
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
import { os } from "@orpc/server";
import type { Prisma } from "@prisma/client";
import type { FdrApplication } from "../../app";

export function createDocsDeploymentRouter(app: FdrApplication) {
    const registerDocsSite = os
        .route({ method: "POST", path: "/register" })
        .input(RegisterDocsSiteInputSchema)
        .output(DocsSiteSchema)
        .handler(async ({ input }) => {
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
        .input(GetDocsStatusInputSchema)
        .output(GetDocsStatusResponseSchema)
        .handler(async ({ input }) => {
            const status = await app.dao
                .docsSite()
                .getDocsStatus(input.domain, input.orgId, input.basepath ?? undefined);
            return { status };
        });

    const setDocsStatus = os
        .route({ method: "PUT", path: "/status" })
        .input(SetDocsStatusInputSchema)
        .output(DocsSiteSchema)
        .handler(async ({ input }) => {
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
        .input(CreateDeploymentInputSchema)
        .output(CreateDeploymentResponseSchema)
        .handler(async ({ input }) => {
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
        .input(UpdateDeploymentStatusInputSchema)
        .output(UpdateDeploymentStatusResponseSchema)
        .handler(async ({ input }) => {
            await app.dao
                .docsSite()
                .updateDeploymentStatus(input.deploymentId, input.status, input.updatedBy ?? undefined);
            return { success: true };
        });

    const getDocsDeployments = os
        .route({ method: "GET", path: "/deployments" })
        .input(GetDocsDeploymentsInputSchema)
        .output(GetDocsDeploymentsResponseSchema)
        .handler(async ({ input }) => {
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
        .input(GetPostmanCollectionIdInputSchema)
        .output(GetPostmanCollectionIdResponseSchema)
        .handler(async ({ input }) => {
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
