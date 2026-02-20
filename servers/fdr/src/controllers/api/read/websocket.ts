import * as z from "zod";

import {
    AvailabilitySchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    PropertyKeySchema,
    WebSocketIdSchema,
    WebSocketMessageIdSchema,
    WebSocketMessageOriginSchema
} from "../register/commons";
import { EndpointPathSchema, HeaderSchema, QueryParameterSchema } from "./endpoint";
import { ObjectTypeSchema, TypeReferenceSchema } from "./type";

export const WebSocketMessageBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema })
]);
export type WebSocketMessageBodyShape = z.infer<typeof WebSocketMessageBodyShapeSchema>;

export const WebSocketMessageSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    type: WebSocketMessageIdSchema,
    displayName: z.string().nullish(),
    origin: WebSocketMessageOriginSchema,
    body: WebSocketMessageBodyShapeSchema
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

export const ExampleWebSocketMessageSchema = z.object({
    type: WebSocketMessageIdSchema,
    body: z.unknown()
});
export type ExampleWebSocketMessage = z.infer<typeof ExampleWebSocketMessageSchema>;

export const ExampleWebSocketSessionSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    path: z.string(),
    pathParameters: z.record(PropertyKeySchema, z.unknown()),
    queryParameters: z.record(z.string(), z.unknown()),
    headers: z.record(z.string(), z.unknown()),
    messages: z.array(ExampleWebSocketMessageSchema)
});
export type ExampleWebSocketSession = z.infer<typeof ExampleWebSocketSessionSchema>;

export const WebSocketChannelSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    urlSlug: z.string(),
    id: WebSocketIdSchema,
    auth: z.boolean(),
    name: z.string().nullish(),
    defaultEnvironment: EnvironmentIdSchema.nullish(),
    environments: z.array(EnvironmentSchema),
    path: EndpointPathSchema,
    headers: z.array(HeaderSchema),
    queryParameters: z.array(QueryParameterSchema),
    messages: z.array(WebSocketMessageSchema),
    examples: z.array(ExampleWebSocketSessionSchema)
});
export type WebSocketChannel = z.infer<typeof WebSocketChannelSchema>;
