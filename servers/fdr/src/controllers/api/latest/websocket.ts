import * as z from "zod";

import {
    AuthSchemeIdSchema,
    AvailabilitySchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    PathPartSchema,
    PropertyKeySchema,
    WebSocketIdSchema,
    WebSocketMessageIdSchema,
    WebSocketMessageOriginSchema
} from "./commons";
import { ObjectPropertySchema, ParameterPropertySchema, TypeShapeSchema } from "./type";

export const WebSocketMessageSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    type: WebSocketMessageIdSchema,
    displayName: z.string().nullish(),
    origin: WebSocketMessageOriginSchema,
    body: TypeShapeSchema
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

export const ExampleWebSocketMessageSchema = z.object({
    type: WebSocketMessageIdSchema,
    body: z.unknown()
});
export type ExampleWebSocketMessage = z.infer<typeof ExampleWebSocketMessageSchema>;

export const ExampleWebSocketSessionSchema = z.object({
    description: z.string().nullish(),
    path: z.string(),
    name: z.string().nullish(),
    pathParameters: z.record(PropertyKeySchema, z.unknown()).nullish(),
    queryParameters: z.record(PropertyKeySchema, z.unknown()).nullish(),
    requestHeaders: z.record(PropertyKeySchema, z.unknown()).nullish(),
    messages: z.array(ExampleWebSocketMessageSchema).nullish()
});
export type ExampleWebSocketSession = z.infer<typeof ExampleWebSocketSessionSchema>;

export const WebSocketChannelSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    namespace: z.array(z.string()).nullish(),
    id: WebSocketIdSchema,
    displayName: z.string().nullish(),
    operationId: z.string().nullish(),
    path: z.array(PathPartSchema),
    messages: z.array(WebSocketMessageSchema),
    auth: z.array(AuthSchemeIdSchema).nullish(),
    defaultEnvironment: EnvironmentIdSchema.nullish(),
    environments: z.array(EnvironmentSchema).nullish(),
    pathParameters: z.array(ParameterPropertySchema).nullish(),
    queryParameters: z.array(ParameterPropertySchema).nullish(),
    requestHeaders: z.array(ObjectPropertySchema).nullish(),
    examples: z.array(ExampleWebSocketSessionSchema).nullish()
});
export type WebSocketChannel = z.infer<typeof WebSocketChannelSchema>;
