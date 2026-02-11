/**
 * OpenAPI Location Resolver
 *
 * Maps FDR identifiers to OpenAPI spec locations for description editing.
 */

export { createResolver, getParameterDetails, OpenApiResolver } from "./resolver";
export type {
    DescriptionTarget,
    EndpointDescriptionTarget,
    OpenApiLocation,
    OpenApiResolverFailureReason,
    OpenApiResolverResult,
    ParameterDescriptionTarget,
    PropertyDescriptionTarget,
    RequestBodyDescriptionTarget,
    ResponseDescriptionTarget,
    SchemaDescriptionTarget,
    SecuritySchemeDescriptionTarget
} from "./types";
export { createParameterOverrideContent, updateYamlValue, type YamlUpdateResult } from "./yaml-utils";
