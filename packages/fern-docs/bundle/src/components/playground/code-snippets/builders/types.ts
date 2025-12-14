import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import { buildEndpointUrl, preprocessQueryParameters, wrapOpenRPCRequest } from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";

import type { PlaygroundAuthState, PlaygroundEndpointRequestFormState } from "../../types";

export abstract class PlaygroundCodeSnippetBuilder {
    protected url: string;
    protected processedQueryParameters: Record<string, unknown>;

    constructor(
        protected context: EndpointContext,
        protected formState: PlaygroundEndpointRequestFormState,
        protected authState: PlaygroundAuthState,
        protected baseUrl: string | undefined,
        protected redacted: boolean,
        protected selectedAuthSchemes?: APIV1Read.ApiAuth[]
    ) {
        // Preprocess query parameters based on explode metadata
        this.processedQueryParameters =
            preprocessQueryParameters(formState.queryParameters, context.endpoint.queryParameters) ?? {};

        // TODO: wire through the environment from hook
        this.url = buildEndpointUrl({
            endpoint: context.endpoint,
            pathParameters: formState.pathParameters,
            baseUrl
        });
    }

    protected maybeWrapJsonBody(body: unknown): unknown {
        if (this.context.endpoint.protocol?.type === "openrpc") {
            return wrapOpenRPCRequest(body, this.context.endpoint.protocol.methodName);
        }
        return body;
    }

    public abstract build(): string;
}
