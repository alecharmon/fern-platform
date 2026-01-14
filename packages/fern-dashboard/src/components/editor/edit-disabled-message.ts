import type { OpenApiResolverFailureReason } from "@/providers/OpenApiSpecsContext";

/** Returns human-readable message explaining why editing is disabled. */
export function getEditDisabledMessage(reason?: OpenApiResolverFailureReason): string {
    switch (reason) {
        case "non-openapi-format":
            return "This API is defined in a format that is not yet editable (AsyncAPI, OpenRPC, gRPC, or Fern Definition)";
        case "composition-type":
            return "This field uses allOf/oneOf/anyOf composition which is not directly editable";
        case "unsupported-ref":
            return "This field uses a complex reference pattern that cannot be resolved";
        case "unsupported-protocol":
            return "WebSocket and Webhook descriptions are not yet editable";
        case "not-found":
            return "This field could not be found in the OpenAPI specification";
        case "editing-not-available":
            return "Description editing is not available";
        default:
            return "This description cannot be edited";
    }
}
