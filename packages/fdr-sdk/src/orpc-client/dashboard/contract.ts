import { oc } from "@orpc/contract";
import * as z from "zod";

// ── Schemas ──────────────────────────────────────────────────────────

export const DocsSiteUrlSchema = z.object({
    domain: z.string(),
    path: z.string().optional()
});
export type DocsSiteUrl = z.infer<typeof DocsSiteUrlSchema>;

export const DashboardDocsSiteSchema = z.object({
    mainUrl: DocsSiteUrlSchema,
    urls: z.array(DocsSiteUrlSchema)
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

// ── Contract ─────────────────────────────────────────────────────────

export const dashboardContract = {
    getDocsSitesForOrg: oc
        .route({ method: "POST", path: "/get-docs-sites-for-org" })
        .input(GetDocsSitesForOrgInputSchema)
        .output(GetDocsSitesForOrgResponseSchema)
};
