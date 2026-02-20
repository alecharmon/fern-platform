import * as z from "zod";

import {
    AvailabilitySchema,
    ExampleWebhookPayloadSchema,
    WebhookHttpMethodSchema,
    WebhookIdSchema,
    WebhookPayloadSchema
} from "../shared";

import { HeaderSchema, HttpResponseSchema } from "./endpoint";

export type {
    ExampleWebhookPayload,
    WebhookPayload,
    WebhookPayloadShape
} from "../shared";
export {
    ExampleWebhookPayloadSchema,
    WebhookPayloadSchema,
    WebhookPayloadShapeSchema
} from "../shared";

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
