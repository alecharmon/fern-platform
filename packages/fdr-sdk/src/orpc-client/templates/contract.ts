import { oc } from "@orpc/contract";
import * as z from "zod";
import { HttpMethodSchema, SdkSchema } from "../shared.js";

// ── Snippet Registry Entry ──────────────────────────────────────────────

export const SnippetRegistryEntrySchema = z.object({
    sdk: SdkSchema,
    endpointId: z.object({
        path: z.string(),
        method: HttpMethodSchema,
        identifierOverride: z.string().optional()
    }),
    snippetTemplate: z.object({
        type: z.literal("v1"),
        functionInvocation: z.unknown(),
        clientInstantiation: z.string()
    }),
    additionalTemplates: z.record(z.string(), z.unknown()).optional()
});
export type SnippetRegistryEntry = z.infer<typeof SnippetRegistryEntrySchema>;

// ── Register input ──────────────────────────────────────────────────────

export const RegisterInputSchema = z.object({
    orgId: z.string(),
    apiId: z.string(),
    apiDefinitionId: z.string(),
    snippet: SnippetRegistryEntrySchema
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

// ── Register batch input ────────────────────────────────────────────────

export const RegisterBatchInputSchema = z.object({
    orgId: z.string(),
    apiId: z.string(),
    apiDefinitionId: z.string(),
    snippets: z.array(SnippetRegistryEntrySchema)
});
export type RegisterBatchInput = z.infer<typeof RegisterBatchInputSchema>;

// ── Get input ───────────────────────────────────────────────────────────

export const GetInputSchema = z.object({
    orgId: z.string(),
    apiId: z.string(),
    sdk: SdkSchema,
    endpointId: z.object({
        path: z.string(),
        method: HttpMethodSchema,
        identifierOverride: z.string().optional()
    })
});
export type GetInput = z.infer<typeof GetInputSchema>;

// ── Get output ──────────────────────────────────────────────────────────

export const EndpointSnippetTemplateSchema = z.record(z.string(), z.unknown());
export type EndpointSnippetTemplate = z.infer<typeof EndpointSnippetTemplateSchema>;

// ── Contract ────────────────────────────────────────────────────────────

export const templatesContract = {
    register: oc.route({ method: "POST", path: "/register" }).input(RegisterInputSchema),

    registerBatch: oc.route({ method: "POST", path: "/register/batch" }).input(RegisterBatchInputSchema),

    get: oc.route({ method: "POST", path: "/get" }).input(GetInputSchema).output(EndpointSnippetTemplateSchema)
};
