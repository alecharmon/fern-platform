import { dynamic } from "@fern-api/dynamic-ir-sdk/api";

export abstract class AbstractDynamicSnippetsGenerator {
    /**
     * Generates code for the specified request.
     * @param request
     */
    public abstract generate(request: dynamic.EndpointSnippetRequest): Promise<dynamic.EndpointSnippetResponse>;

    /**
     * Generates code for the specified request.
     * @param request
     */
    public abstract generateSync(request: dynamic.EndpointSnippetRequest): dynamic.EndpointSnippetResponse;
}
