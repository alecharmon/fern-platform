import { compact } from "es-toolkit/array";
import { pick } from "es-toolkit/object";

import type { FernUser } from "@fern-api/docs-auth";
import type { ObjectProperty, WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import { EMPTY_OBJECT } from "@fern-api/ui-core-utils";

import type { PlaygroundWebSocketRequestFormState } from "../types";
import { getEmptyValueForObjectProperties, getEmptyValueForType } from "./default-values";

export function getInitialWebSocketRequestFormState(
    context: WebSocketContext,
    playgroundInitialState: NonNullable<FernUser["playground"]>["initial_state"] | undefined
): PlaygroundWebSocketRequestFormState {
    return {
        type: "websocket",
        headers: {
            ...getEmptyValueForObjectProperties(
                compact([context.globalHeaders, context.channel.requestHeaders]).flat(),
                context.types ?? EMPTY_OBJECT
            ),
            ...filterParams(
                playgroundInitialState?.headers ?? {},
                compact([context.globalHeaders, context.channel.requestHeaders]).flat()
            )
        },
        pathParameters: {
            ...getEmptyValueForObjectProperties(context.channel.pathParameters, context.types ?? EMPTY_OBJECT),
            ...filterParams(playgroundInitialState?.path_parameters ?? {}, context.channel.pathParameters ?? [])
        },
        queryParameters: {
            ...getEmptyValueForObjectProperties(context.channel.queryParameters, context.types ?? EMPTY_OBJECT),
            ...filterParams(playgroundInitialState?.query_parameters ?? {}, context.channel.queryParameters ?? [])
        },
        messages: Object.fromEntries(
            context.channel.messages
                .filter((message) => message.origin === "client")
                .map((message) => [message.type, getEmptyValueForType(message.body, context.types)]) ?? []
        )
    };
}

function filterParams(
    initialStateParams: Record<string, string>,
    requestParams: ObjectProperty[]
): Record<string, string> {
    return pick(
        initialStateParams,
        requestParams.map((param) => param.key)
    );
}
