import * as z from "zod";

import { AvailabilitySchema, WebhookHttpMethodSchema, WebhookIdSchema } from "./commons";
import { HeaderSchema, HttpResponseSchema } from "./endpoint";
import { FormDataRequestSchema, ObjectTypeSchema, TypeReferenceSchema } from "./type";

export const WebhookPayloadShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("formData"), ...FormDataRequestSchema.shape })
]);
export type WebhookPayloadShape = z.infer<typeof WebhookPayloadShapeSchema>;

export const WebhookPayloadSchema = z.object({
    description: z.string().nullish(),
    type: WebhookPayloadShapeSchema
});
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export const ExampleWebhookPayloadSchema = z.object({
    name: z.string().nullish(),
    payload: z.unknown()
});
export type ExampleWebhookPayload = z.infer<typeof ExampleWebhookPayloadSchema>;

export const WebhookDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    method: WebhookHttpMethodSchema,
    id: WebhookIdSchema,
    name: z.string().nullish(),
    path: z.array(z.string()),
    headers: z.array(HeaderSchema),
    payload: WebhookPayloadSchema,
    responses: z.array(HttpResponseSchema).nullish(),
    examples: z.array(ExampleWebhookPayloadSchema)
});
export type WebhookDefinition = z.infer<typeof WebhookDefinitionSchema>;
