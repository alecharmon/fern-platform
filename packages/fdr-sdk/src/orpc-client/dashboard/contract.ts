import { oc } from "@orpc/contract";
import * as z from "zod";

import { DocsDeploymentStatusSchema } from "../docs-deployment/contract.js";

// ── Schemas ──────────────────────────────────────────────────────────

export const DocsSiteUrlSchema = z.object({
    domain: z.string(),
    path: z.string().nullish()
});
export type DocsSiteUrl = z.infer<typeof DocsSiteUrlSchema>;

export const DashboardDocsSiteSchema = z.object({
    mainUrl: DocsSiteUrlSchema,
    urls: z.array(DocsSiteUrlSchema),
    status: DocsDeploymentStatusSchema
});
export type DashboardDocsSite = z.infer<typeof DashboardDocsSiteSchema>;

export const GetDocsSitesForOrgInputSchema = z.object({
    orgId: z.string()
});
export type GetDocsSitesForOrgInput = z.infer<typeof GetDocsSitesForOrgInputSchema>;

export const GetDocsSitesForOrgResponseSchema = z.object({
    docsSites: z.array(DashboardDocsSiteSchema)
});
export type GetDocsSitesForOrgResponse = z.infer<typeof GetDocsSitesForOrgResponseSchema>;

export const DeleteAllDocsSitesForOrgInputSchema = z.object({
    orgId: z.string()
});
export type DeleteAllDocsSitesForOrgInput = z.infer<typeof DeleteAllDocsSitesForOrgInputSchema>;

export const DeleteAllDocsSitesForOrgResponseSchema = z.object({
    deletedCount: z.number()
});
export type DeleteAllDocsSitesForOrgResponse = z.infer<typeof DeleteAllDocsSitesForOrgResponseSchema>;

// ── Contract ─────────────────────────────────────────────────────────

export const dashboardContract = {
    getDocsSitesForOrg: oc
        .route({ method: "POST", path: "/get-docs-sites-for-org" })
        .input(GetDocsSitesForOrgInputSchema)
        .output(GetDocsSitesForOrgResponseSchema),
    deleteAllDocsSitesForOrg: oc
        .route({ method: "DELETE", path: "/{orgId}/docs" })
        .input(DeleteAllDocsSitesForOrgInputSchema)
        .output(DeleteAllDocsSitesForOrgResponseSchema)
};
