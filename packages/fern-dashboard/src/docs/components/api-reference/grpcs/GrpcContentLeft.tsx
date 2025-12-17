"use client";

/**
 * Dashboard-specific GrpcContentLeft (client-side MDX).
 *
 * Renders the left reference panel with request/response bodies for gRPC methods.
 * Uses dashboard's local type definition components for client-side MDX rendering.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/grpcs/GrpcContentLeft.tsx
 */

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type { GrpcContext } from "@fern-api/fdr-sdk/api-definition";
import {
    createEndpointRequestDescriptionFallback,
    EndpointRequestSection
} from "@fern-docs/components/api-reference/endpoints/EndpointRequestSection";
import { EndpointResponseSection } from "@fern-docs/components/api-reference/endpoints/EndpointResponseSection";
import { ResponseSummaryFallback } from "@fern-docs/components/api-reference/endpoints/response-summary-fallback";
import { GrpcSection } from "@fern-docs/components/api-reference/grpcs/GrpcSection";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionResponse
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { t } from "@fern-docs/i18n";

import { MdxContent } from "@/docs/mdx/components/MdxContent";

import { PropertyRenderer, PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

export function GrpcContentLeft({ context: { grpc, types }, lang }: { context: GrpcContext; lang: string }) {
    return (
        <>
            <TypeDefinitionAnchorPart part="request">
                {grpc.requests?.[0] != null && (
                    <GrpcSection
                        title={
                            isStreaming(grpc.protocol, "request")
                                ? t(lang).playground.streamRequest
                                : t(lang).apiReference.request
                        }
                        titleOverride={
                            isGrpcTypeAlias(grpc.requests[0], grpc.protocol?.type)
                                ? types[grpc.requests[0].body.value.id]?.displayName
                                : undefined
                        }
                        description={
                            <MdxContent
                                size="sm"
                                className="text-(color:--grayscale-a11)"
                                mdx={grpc.requests[0].description}
                                fallback={createEndpointRequestDescriptionFallback(grpc.requests[0], types, lang)}
                            />
                        }
                    >
                        <TypeDefinitionAnchorPart part="body">
                            <EndpointRequestSection
                                request={grpc.requests[0]}
                                types={types}
                                lang={lang}
                                PropertyRenderer={PropertyRenderer}
                                PropertyWithShape={PropertyWithShape}
                                TypeReferenceDefinitions={TypeReferenceDefinitions}
                            />
                        </TypeDefinitionAnchorPart>
                    </GrpcSection>
                )}
            </TypeDefinitionAnchorPart>
            <TypeDefinitionResponse>
                <TypeDefinitionAnchorPart part="response">
                    {grpc.responses?.[0] != null && (
                        <GrpcSection
                            title={
                                isStreaming(grpc.protocol, "response")
                                    ? t(lang).playground.streamResponse
                                    : t(lang).apiReference.response
                            }
                            titleOverride={
                                isGrpcTypeAlias(grpc.responses[0], grpc.protocol?.type)
                                    ? types[grpc.responses[0].body.value.id]?.displayName
                                    : undefined
                            }
                            description={
                                <MdxContent
                                    size="sm"
                                    className="text-(color:--grayscale-a11)"
                                    mdx={grpc.responses[0].description}
                                    fallback={
                                        <ResponseSummaryFallback
                                            response={grpc.responses[0]}
                                            types={types}
                                            lang={lang}
                                        />
                                    }
                                />
                            }
                        >
                            <TypeDefinitionAnchorPart part="body">
                                <EndpointResponseSection
                                    body={grpc.responses[0].body}
                                    types={types}
                                    lang={lang}
                                    TypeReferenceDefinitions={TypeReferenceDefinitions}
                                />
                            </TypeDefinitionAnchorPart>
                        </GrpcSection>
                    )}
                </TypeDefinitionAnchorPart>
            </TypeDefinitionResponse>
        </>
    );
}

type GrpcTypeAlias =
    | (ApiDefinition.HttpRequest & {
          contentType: "application/proto";
          body: ApiDefinition.HttpRequestBodyShape.Alias & {
              value: ApiDefinition.TypeReference.Id;
          };
      })
    | (ApiDefinition.HttpResponse & {
          statusCode: number;
          body: ApiDefinition.HttpResponseBodyShape.Alias & {
              value: ApiDefinition.TypeReference.Id;
          };
      });

function isGrpcTypeAlias(
    item: ApiDefinition.HttpRequest | ApiDefinition.HttpResponse,
    protocolType: string | undefined
): item is GrpcTypeAlias {
    const hasAliasId = item.body?.type === "alias" && item.body.value?.type === "id";
    const isGrpc = protocolType === "grpc";
    if (!hasAliasId || !isGrpc) {
        return false;
    }

    if ("contentType" in item) {
        return item.contentType === "application/proto";
    }

    return "statusCode" in item;
}

function isStreaming(protocol: ApiDefinition.Protocol | undefined, location: "request" | "response"): boolean {
    if (protocol?.type !== "grpc") {
        return false;
    }
    if (protocol.methodType === "BIDIRECTIONAL_STREAM") {
        return true;
    }
    if (location === "request" && protocol.methodType === "CLIENT_STREAM") {
        return true;
    }
    if (location === "response" && protocol.methodType === "SERVER_STREAM") {
        return true;
    }
    return false;
}
