import * as z from "zod";

import { EndpointIdSchema } from "./commons";

export const BearerAuthSchema = z.object({
    description: z.string().nullish(),
    tokenName: z.string().nullish()
});
export type BearerAuth = z.infer<typeof BearerAuthSchema>;

export const BasicAuthSchema = z.object({
    description: z.string().nullish(),
    usernameName: z.string().nullish(),
    passwordName: z.string().nullish(),
    passwordAlwaysEmpty: z.boolean().nullish()
});
export type BasicAuth = z.infer<typeof BasicAuthSchema>;

export const HeaderAuthSchema = z.object({
    description: z.string().nullish(),
    nameOverride: z.string().nullish(),
    headerWireValue: z.string(),
    prefix: z.string().nullish()
});
export type HeaderAuth = z.infer<typeof HeaderAuthSchema>;

export const OAuthClientCredentialsReferencedEndpointSchema = z.object({
    description: z.string().nullish(),
    endpointId: EndpointIdSchema,
    accessTokenLocator: z.string(),
    headerName: z.string().nullish(),
    tokenPrefix: z.string().nullish()
});
export type OAuthClientCredentialsReferencedEndpoint = z.infer<typeof OAuthClientCredentialsReferencedEndpointSchema>;

export const OAuthClientCredentialsSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("referencedEndpoint"),
        ...OAuthClientCredentialsReferencedEndpointSchema.shape
    })
]);
export type OAuthClientCredentials = z.infer<typeof OAuthClientCredentialsSchema>;

export const OAuthSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("clientCredentials"), value: OAuthClientCredentialsSchema })
]);
export type OAuth = z.infer<typeof OAuthSchema>;

export const AuthSchemeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("bearerAuth"), ...BearerAuthSchema.shape }),
    z.object({ type: z.literal("basicAuth"), ...BasicAuthSchema.shape }),
    z.object({ type: z.literal("header"), ...HeaderAuthSchema.shape }),
    z.object({ type: z.literal("oAuth"), value: OAuthSchema })
]);
export type AuthScheme = z.infer<typeof AuthSchemeSchema>;
