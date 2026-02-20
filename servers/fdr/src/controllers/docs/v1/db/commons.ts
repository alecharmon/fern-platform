import * as z from "zod";

export const PageIdSchema = z.string();
export type PageId = z.infer<typeof PageIdSchema>;

export const ApiDefinitionIdSchema = z.string().uuid();
export type ApiDefinitionId = z.infer<typeof ApiDefinitionIdSchema>;

export const FileIdSchema = z.string();
export type FileId = z.infer<typeof FileIdSchema>;

export const UrlSchema = z.string();
export type Url = z.infer<typeof UrlSchema>;

export const VersionIdSchema = z.string();
export type VersionId = z.infer<typeof VersionIdSchema>;

export const EndpointIdSchema = z.string();
export type EndpointId = z.infer<typeof EndpointIdSchema>;

export const WebSocketIdSchema = z.string();
export type WebSocketId = z.infer<typeof WebSocketIdSchema>;

export const WebhookIdSchema = z.string();
export type WebhookId = z.infer<typeof WebhookIdSchema>;

export const SubpackageIdSchema = z.string();
export type SubpackageId = z.infer<typeof SubpackageIdSchema>;

export const RoleIdSchema = z.string();
export type RoleId = z.infer<typeof RoleIdSchema>;

export const AvailabilitySchema = z.enum([
    "Stable",
    "GenerallyAvailable",
    "InDevelopment",
    "PreRelease",
    "Deprecated",
    "Beta"
]);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const LinkTargetSchema = z.enum(["_blank", "_self", "_parent", "_top"]);
export type LinkTarget = z.infer<typeof LinkTargetSchema>;
