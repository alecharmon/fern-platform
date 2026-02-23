import { oc } from "@orpc/contract";
import * as z from "zod";

// -- Enums --

export const DocsDeploymentStatusSchema = z.enum(["PUBLISHING", "LIVE", "UNPUBLISHED", "ERROR"]);
export type DocsDeploymentStatus = z.infer<typeof DocsDeploymentStatusSchema>;

// -- Shared output schemas --

export const DocsSiteSchema = z.object({
    id: z.string(),
    orgId: z.string(),
    domain: z.string(),
    basepath: z.string(),
    previewUrl: z.string().optional(),
    status: DocsDeploymentStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string()
});
export type DocsSite = z.infer<typeof DocsSiteSchema>;

export const DocsDeploymentSchema = z.object({
    id: z.string(),
    orgId: z.string(),
    domain: z.string(),
    basepath: z.string(),
    createdAt: z.string(),
    createdBy: z.string().optional(),
    status: DocsDeploymentStatusSchema,
    updatedAt: z.string(),
    updatedBy: z.string().optional(),
    previewUrl: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
});
export type DocsDeployment = z.infer<typeof DocsDeploymentSchema>;

// -- Input schemas --

export const RegisterDocsSiteInputSchema = z.object({
    domain: z.string(),
    orgId: z.string(),
    basepath: z.string().optional(),
    previewUrl: z.string().optional()
});
export type RegisterDocsSiteInput = z.infer<typeof RegisterDocsSiteInputSchema>;

export const GetDocsStatusInputSchema = z.object({
    domain: z.string(),
    orgId: z.string(),
    basepath: z.string().optional()
});
export type GetDocsStatusInput = z.infer<typeof GetDocsStatusInputSchema>;

export const SetDocsStatusInputSchema = z.object({
    domain: z.string(),
    orgId: z.string(),
    basepath: z.string().optional(),
    status: DocsDeploymentStatusSchema
});
export type SetDocsStatusInput = z.infer<typeof SetDocsStatusInputSchema>;

export const CreateDeploymentInputSchema = z.object({
    domain: z.string(),
    orgId: z.string(),
    userId: z.string().optional(),
    basepath: z.string().optional(),
    previewUrl: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
});
export type CreateDeploymentInput = z.infer<typeof CreateDeploymentInputSchema>;

export const UpdateDeploymentStatusInputSchema = z.object({
    deploymentId: z.string(),
    status: DocsDeploymentStatusSchema,
    updatedBy: z.string().optional()
});
export type UpdateDeploymentStatusInput = z.infer<typeof UpdateDeploymentStatusInputSchema>;

export const GetDocsDeploymentsInputSchema = z.object({
    domain: z.string(),
    orgId: z.string(),
    basepath: z.string().optional(),
    limit: z.coerce.number().optional()
});
export type GetDocsDeploymentsInput = z.infer<typeof GetDocsDeploymentsInputSchema>;

// -- Response schemas --

export const GetDocsStatusResponseSchema = z.object({
    status: DocsDeploymentStatusSchema.nullable()
});
export type GetDocsStatusResponse = z.infer<typeof GetDocsStatusResponseSchema>;

export const GetDocsDeploymentsResponseSchema = z.object({
    deployments: z.array(DocsDeploymentSchema)
});
export type GetDocsDeploymentsResponse = z.infer<typeof GetDocsDeploymentsResponseSchema>;

export const CreateDeploymentResponseSchema = z.object({
    deploymentId: z.string()
});
export type CreateDeploymentResponse = z.infer<typeof CreateDeploymentResponseSchema>;

export const UpdateDeploymentStatusResponseSchema = z.object({
    success: z.boolean()
});
export type UpdateDeploymentStatusResponse = z.infer<typeof UpdateDeploymentStatusResponseSchema>;

// -- Contract --

export const docsDeploymentContract = {
    registerDocsSite: oc
        .route({ method: "POST", path: "/register" })
        .input(RegisterDocsSiteInputSchema)
        .output(DocsSiteSchema),

    getDocsStatus: oc
        .route({ method: "GET", path: "/status" })
        .input(GetDocsStatusInputSchema)
        .output(GetDocsStatusResponseSchema),

    setDocsStatus: oc.route({ method: "PUT", path: "/status" }).input(SetDocsStatusInputSchema).output(DocsSiteSchema),

    createDeployment: oc
        .route({ method: "POST", path: "/deployment" })
        .input(CreateDeploymentInputSchema)
        .output(CreateDeploymentResponseSchema),

    updateDeploymentStatus: oc
        .route({ method: "PATCH", path: "/deployment/{deploymentId}" })
        .input(UpdateDeploymentStatusInputSchema)
        .output(UpdateDeploymentStatusResponseSchema),

    getDocsDeployments: oc
        .route({ method: "GET", path: "/deployments" })
        .input(GetDocsDeploymentsInputSchema)
        .output(GetDocsDeploymentsResponseSchema)
};
