import * as z from "zod";

// ── Org / API identifiers ──────────────────────────────────────────────

export const OrgIdSchema = z.string();
export type OrgId = z.infer<typeof OrgIdSchema>;

export const ApiIdSchema = z.string();
export type ApiId = z.infer<typeof ApiIdSchema>;

export const ApiDefinitionIdSchema = z.string().uuid();
export type ApiDefinitionId = z.infer<typeof ApiDefinitionIdSchema>;

// ── HTTP / Endpoint schemas ─────────────────────────────────────────────

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const UrlSchema = z.string();
export type Url = z.infer<typeof UrlSchema>;

export const EndpointPathLiteralSchema = z.string();
export type EndpointPathLiteral = z.infer<typeof EndpointPathLiteralSchema>;

export const EndpointIdentifierSchema = z.object({
    path: z.string(),
    method: HttpMethodSchema,
    identifierOverride: z.string().nullish()
});
export type EndpointIdentifier = z.infer<typeof EndpointIdentifierSchema>;

// ── SDK request schema ──────────────────────────────────────────────────

export const SdkRequestSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("typescript"), package: z.string(), version: z.string().nullish() }),
    z.object({ type: z.literal("python"), package: z.string(), version: z.string().nullish() }),
    z.object({ type: z.literal("go"), githubRepo: z.string(), version: z.string().nullish() }),
    z.object({ type: z.literal("ruby"), gem: z.string(), version: z.string().nullish() }),
    z.object({
        type: z.literal("java"),
        group: z.string(),
        artifact: z.string(),
        version: z.string().nullish()
    }),
    z.object({ type: z.literal("csharp"), package: z.string(), version: z.string().nullish() })
]);
export type SdkRequest = z.infer<typeof SdkRequestSchema>;
