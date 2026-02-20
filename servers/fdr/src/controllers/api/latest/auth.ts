import * as z from "zod";

export type {
    BasicAuth,
    BearerAuth,
    HeaderAuth,
    OAuth,
    OAuthClientCredentials,
    OAuthClientCredentialsReferencedEndpoint
} from "../shared";
export {
    BasicAuthSchema,
    BearerAuthSchema,
    HeaderAuthSchema,
    OAuthClientCredentialsReferencedEndpointSchema,
    OAuthClientCredentialsSchema,
    OAuthSchema
} from "../shared";

import { BasicAuthSchema, BearerAuthSchema, HeaderAuthSchema, OAuthSchema } from "../shared";

export const AuthSchemeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("bearerAuth"), ...BearerAuthSchema.shape }),
    z.object({ type: z.literal("basicAuth"), ...BasicAuthSchema.shape }),
    z.object({ type: z.literal("header"), ...HeaderAuthSchema.shape }),
    z.object({ type: z.literal("oAuth"), value: OAuthSchema })
]);
export type AuthScheme = z.infer<typeof AuthSchemeSchema>;
