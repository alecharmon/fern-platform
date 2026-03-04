import type { FernIr } from "@fern-api/dynamic-ir-sdk";

export abstract class AbstractDynamicSnippetsGenerator {
    /**
     * Generates code for the specified request.
     * @param request
     */
    public abstract generate(
        request: FernIr.dynamic.EndpointSnippetRequest
    ): Promise<FernIr.dynamic.EndpointSnippetResponse>;

    /**
     * Generates code for the specified request.
     * @param request
     */
    public abstract generateSync(
        request: FernIr.dynamic.EndpointSnippetRequest
    ): FernIr.dynamic.EndpointSnippetResponse;
}
