import type { WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { EndpointAuthSection } from "@fern-docs/components/api-reference/endpoints/EndpointAuthSection";
import { EndpointSection } from "@fern-docs/components/api-reference/endpoints/EndpointSection";
import { TypeDefinitionAnchorPart } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { CardedSection } from "@fern-docs/components/api-reference/websockets/CardedSection";
import { t } from "@fern-docs/i18n";
import { ArrowDown, ArrowUp, Wifi } from "lucide-react";
import { PlaygroundButton } from "@/components/playground/PlaygroundButton";
import { ApiReferenceClientWrapper } from "../ApiReferenceClientWrapper";
import { EndpointUrlWithPlaygroundBaseUrl } from "../endpoints/EndpointUrlWithPlaygroundBaseUrl";
import { ObjectProperty, PropertyRenderer } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";
import { CopyWithBaseUrl } from "./CopyWithBaseUrl";

function flattenWebSocketShape(
    messages: ApiDefinition.WebSocketMessage[],
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
) {
    return messages.flatMap((message): ApiDefinition.UndiscriminatedUnionVariant[] => {
        const unwrapped = ApiDefinition.unwrapReference(message.body, types);
        if (unwrapped.shape.type === "undiscriminatedUnion") {
            return unwrapped.shape.variants;
        }
        return [
            {
                description: message.description,
                availability: message.availability,
                displayName: message.displayName ?? message.type,
                shape: message.body
            }
        ];
    });
}

export function WebSocketContentLeft({
    context,
    lang,
    showUnionsAsDropdown = false
}: {
    context: WebSocketContext;
    lang: string;
    showUnionsAsDropdown?: boolean;
}) {
    const { channel, node, types, globalHeaders, auths, authOptions } = context;

    const publishMessages = channel.messages.filter(
        (message) => message.origin === APIV1Read.WebSocketMessageOrigin.Client
    );
    const subscribeMessages = channel.messages.filter(
        (message) => message.origin === APIV1Read.WebSocketMessageOrigin.Server
    );

    const publishMessageShape: ApiDefinition.TypeShape.UndiscriminatedUnion = {
        type: "undiscriminatedUnion",
        variants: flattenWebSocketShape(publishMessages, types)
    };

    const subscribeMessageShape: ApiDefinition.TypeShape.UndiscriminatedUnion = {
        type: "undiscriminatedUnion",
        variants: flattenWebSocketShape(subscribeMessages, types)
    };

    const headers = [...globalHeaders, ...(channel.requestHeaders ?? [])];

    return (
        <>
            <CardedSection
                number={1}
                title={
                    <span className="flex w-full items-center justify-between">
                        <span className="inline-flex items-center gap-2">
                            {t(lang).apiReference.handshake}
                            <span className="bg-(color:--grayscale-a3) inline-block rounded-full p-1">
                                <Wifi className="text-(color:--grayscale-a11) size-icon" strokeWidth={1.5} />
                            </span>
                        </span>
                        {node != null && (
                            <>
                                <PlaygroundButton state={node} className="md:hidden" lang={lang} />
                            </>
                        )}
                    </span>
                }
                slug={node.slug}
                headingElement={
                    <ApiReferenceClientWrapper apiDefinitionId={node.apiDefinitionId}>
                        <div className="border-border-default rounded-3 -mx-2 flex items-center justify-between border px-2 py-1 transition-colors">
                            <EndpointUrlWithPlaygroundBaseUrl endpoint={channel} method="WSS" lang={lang} />
                            <CopyWithBaseUrl channel={channel} lang={lang} />
                        </div>
                    </ApiReferenceClientWrapper>
                }
            >
                <TypeDefinitionAnchorPart part="request">
                    {(authOptions.length > 0 || auths.length > 0) && (
                        <TypeDefinitionAnchorPart part="auth">
                            <EndpointAuthSection
                                authOptions={authOptions}
                                auths={auths}
                                lang={lang}
                                className="fern-endpoint-section-auth"
                                PropertyRenderer={PropertyRenderer}
                            />
                        </TypeDefinitionAnchorPart>
                    )}
                    {headers && headers.length > 0 && (
                        <TypeDefinitionAnchorPart part="headers">
                            <EndpointSection title={t(lang).apiReference.headers}>
                                <WithSeparator>
                                    {headers.map((parameter) => (
                                        <ObjectProperty
                                            key={parameter.key}
                                            property={parameter}
                                            types={types}
                                            lang={lang}
                                        />
                                    ))}
                                </WithSeparator>
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                    {channel.pathParameters && channel.pathParameters.length > 0 && (
                        <TypeDefinitionAnchorPart part="path">
                            <EndpointSection title={t(lang).apiReference.pathParameters}>
                                <WithSeparator>
                                    {channel.pathParameters.map((parameter) => (
                                        <ObjectProperty
                                            key={parameter.key}
                                            property={parameter}
                                            types={types}
                                            lang={lang}
                                        />
                                    ))}
                                </WithSeparator>
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                    {channel.queryParameters && channel.queryParameters.length > 0 && (
                        <TypeDefinitionAnchorPart part="query">
                            <EndpointSection title={t(lang).apiReference.queryParameters}>
                                <WithSeparator>
                                    {channel.queryParameters.map((parameter) => {
                                        return (
                                            <ObjectProperty
                                                key={parameter.key}
                                                property={parameter}
                                                types={types}
                                                lang={lang}
                                            />
                                        );
                                    })}
                                </WithSeparator>
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                </TypeDefinitionAnchorPart>
            </CardedSection>

            {publishMessages.length > 0 && (
                <TypeDefinitionAnchorPart part="send">
                    <EndpointSection
                        title={
                            <span className="inline-flex items-center gap-2">
                                {t(lang).buttons.send}
                                <span className="text-(color:--green-a11) bg-(color:--green-a3) inline-block rounded-full p-1">
                                    <ArrowUp className="size-icon" />
                                </span>
                            </span>
                        }
                    >
                        <TypeReferenceDefinitions
                            shape={publishMessageShape}
                            types={types}
                            lang={lang}
                            showUnionsAsDropdown={showUnionsAsDropdown}
                        />
                    </EndpointSection>
                </TypeDefinitionAnchorPart>
            )}
            {subscribeMessages.length > 0 && (
                <TypeDefinitionAnchorPart part="receive">
                    <EndpointSection
                        title={
                            <span className="inline-flex items-center gap-2">
                                {t(lang).playground.receive}
                                <span className="text-(color:--accent-a12) bg-(color:--accent-a3) inline-block rounded-full p-1">
                                    <ArrowDown className="size-icon" />
                                </span>
                            </span>
                        }
                    >
                        <TypeReferenceDefinitions
                            shape={subscribeMessageShape}
                            types={types}
                            lang={lang}
                            showUnionsAsDropdown={showUnionsAsDropdown}
                        />
                    </EndpointSection>
                </TypeDefinitionAnchorPart>
            )}
        </>
    );
}
