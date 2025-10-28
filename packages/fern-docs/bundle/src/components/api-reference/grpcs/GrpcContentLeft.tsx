import "server-only";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type { GrpcContext } from "@fern-api/fdr-sdk/api-definition";

import { I18N } from "@/constants";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

import { createEndpointRequestDescriptionFallback, EndpointRequestSection } from "../endpoints/EndpointRequestSection";
import { EndpointResponseSection } from "../endpoints/EndpointResponseSection";
import { ResponseSummaryFallback } from "../endpoints/response-summary-fallback";
import { TypeDefinitionAnchorPart, TypeDefinitionResponse } from "../type-definitions/TypeDefinitionContext";
import { GrpcSection } from "./GrpcSection";

export interface HoveringProps {
    isHovering: boolean;
}

export async function GrpcContentLeft({ context: { grpc, types } }: { context: GrpcContext }) {
    return (
        <>
            <TypeDefinitionAnchorPart part="request">
                {grpc.requests?.[0] != null && (
                    <GrpcSection
                        title={
                            isStreaming(grpc.protocol, "request")
                                ? I18N.playground.streamRequest
                                : I18N.apiReference.request
                        }
                        titleOverride={
                            isGrpcTypeAlias(grpc.requests[0], grpc.protocol?.type)
                                ? types[grpc.requests[0].body.value.id]?.displayName
                                : undefined
                        }
                        description={
                            <MdxServerComponentProseSuspense
                                size="sm"
                                className="text-(color:--grayscale-a11)"
                                mdx={grpc.requests[0].description}
                                fallback={createEndpointRequestDescriptionFallback(grpc.requests[0], types)}
                            />
                        }
                    >
                        <TypeDefinitionAnchorPart part="body">
                            <EndpointRequestSection request={grpc.requests[0]} types={types} />
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
                                    ? I18N.playground.streamResponse
                                    : I18N.apiReference.response
                            }
                            titleOverride={
                                isGrpcTypeAlias(grpc.responses[0], grpc.protocol?.type)
                                    ? types[grpc.responses[0].body.value.id]?.displayName
                                    : undefined
                            }
                            description={
                                <MdxServerComponentProseSuspense
                                    size="sm"
                                    className="text-(color:--grayscale-a11)"
                                    mdx={grpc.responses[0].description}
                                    fallback={<ResponseSummaryFallback response={grpc.responses[0]} types={types} />}
                                />
                            }
                        >
                            <TypeDefinitionAnchorPart part="body">
                                <EndpointResponseSection body={grpc.responses[0].body} types={types} />
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
    if (!hasAliasId || !isGrpc) return false;

    if ("contentType" in item) {
        return item.contentType === "application/proto";
    }

    return "statusCode" in item;
}

function isStreaming(protocol: ApiDefinition.Protocol | undefined, location: "request" | "response"): boolean {
    if (protocol?.type !== "grpc") return false;
    if (protocol.methodType === "BIDIRECTIONAL_STREAM") return true;
    if (location === "request" && protocol.methodType === "CLIENT_STREAM") return true;
    if (location === "response" && protocol.methodType === "SERVER_STREAM") return true;
    return false;
}
