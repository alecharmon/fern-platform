import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import {
  buildEndpointUrl,
  wrapOpenRPCRequest,
} from "@fern-api/fdr-sdk/api-definition";

import {
  PlaygroundAuthState,
  PlaygroundEndpointRequestFormState,
} from "../../types";

export abstract class PlaygroundCodeSnippetBuilder {
  protected url: string;

  constructor(
    protected context: EndpointContext,
    protected formState: PlaygroundEndpointRequestFormState,
    protected authState: PlaygroundAuthState,
    protected baseUrl: string | undefined,
    protected redacted: boolean
  ) {
    // TODO: wire through the environment from hook
    this.url = buildEndpointUrl({
      endpoint: context.endpoint,
      pathParameters: formState.pathParameters,
      baseUrl,
    });
  }

  protected maybeWrapJsonBody(body: unknown): unknown {
    if (this.context.endpoint.protocol?.type === "openrpc") {
      return wrapOpenRPCRequest(
        body,
        this.context.endpoint.protocol.methodName
      );
    }
    return body;
  }

  public abstract build(): string;
}
