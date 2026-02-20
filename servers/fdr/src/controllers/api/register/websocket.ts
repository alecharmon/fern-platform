import * as z from "zod";

import {
    AvailabilitySchema,
    EndpointPathSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    ExampleWebSocketSessionSchema,
    HeaderSchema,
    QueryParameterSchema,
    WebSocketIdSchema,
    WebSocketMessageSchema
} from "../shared";

export type {
    ExampleWebSocketMessage,
    ExampleWebSocketSession,
    WebSocketMessage,
    WebSocketMessageBodyShape
} from "../shared";
export {
    ExampleWebSocketMessageSchema,
    ExampleWebSocketSessionSchema,
    WebSocketMessageBodyShapeSchema,
    WebSocketMessageSchema
} from "../shared";

export const WebSocketChannelSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
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
