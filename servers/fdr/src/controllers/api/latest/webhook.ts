import * as z from "zod";
import { AvailabilitySchema, TypeIdSchema, WebhookHttpMethodSchema, WebhookIdSchema } from "./commons";
import { HttpResponseSchema } from "./endpoint";
import type { ObjectType, TypeReference } from "./type";
import { FormDataRequestSchema, ObjectPropertySchema, TypeReferenceSchema } from "./type";

export type WebhookPayloadShape =
    | ({ type: "object" } & ObjectType)
    | { type: "alias"; value: TypeReference }
    | ({ type: "formData" } & z.infer<typeof FormDataRequestSchema>);

export const WebhookPayloadShapeSchema: z.ZodType<WebhookPayloadShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("object"),
            extends: z.array(TypeIdSchema),
            properties: z.array(ObjectPropertySchema),
            extraProperties: TypeReferenceSchema.nullish()
        }),
        z.object({ type: z.literal("alias"), value: TypeReferenceSchema }),
        z.object({ type: z.literal("formData"), ...FormDataRequestSchema.shape })
    ])
);

export const WebhookPayloadSchema = z.object({
    description: z.string().nullish(),
    shape: WebhookPayloadShapeSchema
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
    namespace: z.array(z.string()).nullish(),
    id: WebhookIdSchema,
    displayName: z.string().nullish(),
    operationId: z.string().nullish(),
    method: WebhookHttpMethodSchema,
    path: z.array(z.string()),
    headers: z.array(ObjectPropertySchema).nullish(),
    payloads: z.array(WebhookPayloadSchema).nullish(),
    responses: z.array(HttpResponseSchema).nullish(),
    examples: z.array(ExampleWebhookPayloadSchema).nullish()
});
export type WebhookDefinition = z.infer<typeof WebhookDefinitionSchema>;
