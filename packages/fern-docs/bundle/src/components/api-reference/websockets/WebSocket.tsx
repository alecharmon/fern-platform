import "server-only";

import type { WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernScrollArea } from "@fern-docs/components/FernScrollArea";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import { ArrowDown, ArrowUp, Wifi } from "lucide-react";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { PageHeader } from "@/components/PageHeader";
import { PlaygroundButton } from "@/components/playground/PlaygroundButton";
import { PlaygroundKeyboardTrigger } from "@/components/playground/PlaygroundKeyboardTrigger";
import { i18n } from "@/constants";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";

import { PlaygroundButtonTray } from "../../playground/PlaygroundButtonTray";
import { ApiReferenceClientWrapper } from "../ApiReferenceClientWrapper";
import { EndpointSection } from "../endpoints/EndpointSection";
import { EndpointUrlWithPlaygroundBaseUrl } from "../endpoints/EndpointUrlWithPlaygroundBaseUrl";
import { TitledExample } from "../examples/TitledExample";
import { ObjectProperty } from "../type-definitions/ObjectProperty";
import { TypeDefinitionAnchorPart, TypeDefinitionRoot } from "../type-definitions/TypeDefinitionContext";
import { WithSeparator } from "../type-definitions/TypeDefinitionDetails";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";
import { CardedSection } from "./CardedSection";
import { CopyWithBaseUrl } from "./CopyWithBaseUrl";
import { HandshakeExample } from "./HandshakeExample";
import { type WebSocketMessage, WebSocketMessages } from "./WebSocketMessages";

export async function WebSocketContent({
    serialize,
    context,
    breadcrumb,
    bottomNavigation,
    action,
    hideFeedback,
    pageActionOptions,
    markdownPromise
}: {
    serialize: MdxSerializer;
    context: WebSocketContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation: React.ReactNode;
    action?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdownPromise: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
}) {
    const { channel, node, types, globalHeaders } = context;

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

    const example = channel.examples?.[0];

    const exampleMessages: WebSocketMessage[] =
        example?.messages?.map((message) => {
            const messageDefinition = channel.messages.find((m) => m.type === message.type);
            return {
                type: message.type,
                data: {
                    type: "json",
                    data: message.body
                },
                origin: messageDefinition?.origin,
                displayName: messageDefinition?.displayName
            };
        }) ?? [];

    // TODO: combine with auth headers like in Endpoint.tsx
    const headers = [...globalHeaders, ...(channel.requestHeaders ?? [])];

    return (
        <ReferenceLayout
            header={
                <PageHeader
                    serialize={serialize}
                    markdownPromise={markdownPromise}
                    breadcrumb={breadcrumb}
                    title={node.title}
                    tags={
                        channel.availability != null && (
                            <AvailabilityBadge availability={channel.availability} rounded />
                        )
                    }
                    action={action}
                    slug={node.slug}
                    pageActionOptions={pageActionOptions}
                >
                    <ApiReferenceClientWrapper apiDefinitionId={node.apiDefinitionId}>
                        <EndpointUrlWithPlaygroundBaseUrl endpoint={channel} className="hidden lg:flex" method="WSS" />
                    </ApiReferenceClientWrapper>
                </PageHeader>
            }
            aside={
                <ApiReferenceClientWrapper apiDefinitionId={node.apiDefinitionId}>
                    <div className="not-prose grid grid-rows-[repeat(auto-fit,minmax(0,min-content))] gap-6">
                        <TitledExample
                            title={i18n.apiReference.handshake}
                            tryIt={node != null ? <PlaygroundButtonTray state={node} /> : undefined}
                            disableClipboard={true}
                        >
                            <FernScrollArea className="rounded-b-[inherit]" rootClassName="rounded-b-[inherit]">
                                <HandshakeExample channel={channel} example={example} />
                            </FernScrollArea>
                        </TitledExample>
                        {exampleMessages.length > 0 && (
                            <TitledExample title={i18n.apiReference.messages} className="min-h-0 shrink">
                                <FernScrollArea className="rounded-b-[inherit]" rootClassName="rounded-b-[inherit]">
                                    <WebSocketMessages messages={exampleMessages} />
                                </FernScrollArea>
                            </TitledExample>
                        )}
                    </div>
                </ApiReferenceClientWrapper>
            }
            reference={
                <TypeDefinitionRoot types={types} slug={node.slug}>
                    <TypeDefinitionSlotsServer types={types} serialize={serialize}>
                        <CardedSection
                            number={1}
                            title={
                                <span className="flex w-full items-center justify-between">
                                    <span className="inline-flex items-center gap-2">
                                        {i18n.apiReference.handshake}
                                        <span className="bg-(color:--grayscale-a3) inline-block rounded-full p-1">
                                            <Wifi
                                                className="text-(color:--grayscale-a11) size-icon"
                                                strokeWidth={1.5}
                                            />
                                        </span>
                                    </span>
                                    {node != null && (
                                        <>
                                            <PlaygroundButton state={node} className="md:hidden" />
                                        </>
                                    )}
                                </span>
                            }
                            slug={node.slug}
                            headingElement={
                                <ApiReferenceClientWrapper apiDefinitionId={node.apiDefinitionId}>
                                    <div className="border-border-default rounded-3 -mx-2 flex items-center justify-between border px-2 py-1 transition-colors">
                                        <EndpointUrlWithPlaygroundBaseUrl endpoint={channel} method="WSS" />
                                        <CopyWithBaseUrl channel={channel} />
                                    </div>
                                </ApiReferenceClientWrapper>
                            }
                        >
                            <TypeDefinitionAnchorPart part="request">
                                {headers && headers.length > 0 && (
                                    <TypeDefinitionAnchorPart part="headers">
                                        <EndpointSection title={i18n.apiReference.headers}>
                                            <WithSeparator>
                                                {headers.map((parameter) => (
                                                    <ObjectProperty
                                                        serialize={serialize}
                                                        key={parameter.key}
                                                        property={parameter}
                                                        types={types}
                                                    />
                                                ))}
                                            </WithSeparator>
                                        </EndpointSection>
                                    </TypeDefinitionAnchorPart>
                                )}
                                {channel.pathParameters && channel.pathParameters.length > 0 && (
                                    <TypeDefinitionAnchorPart part="path">
                                        <EndpointSection title={i18n.apiReference.pathParameters}>
                                            <WithSeparator>
                                                {channel.pathParameters.map((parameter) => (
                                                    <ObjectProperty
                                                        serialize={serialize}
                                                        key={parameter.key}
                                                        property={parameter}
                                                        types={types}
                                                    />
                                                ))}
                                            </WithSeparator>
                                        </EndpointSection>
                                    </TypeDefinitionAnchorPart>
                                )}
                                {channel.queryParameters && channel.queryParameters.length > 0 && (
                                    <TypeDefinitionAnchorPart part="query">
                                        <EndpointSection title={i18n.apiReference.queryParameters}>
                                            <WithSeparator>
                                                {channel.queryParameters.map((parameter) => {
                                                    return (
                                                        <ObjectProperty
                                                            serialize={serialize}
                                                            key={parameter.key}
                                                            property={parameter}
                                                            types={types}
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
                                            {i18n.buttons.send}
                                            <span className="text-(color:--green-a11) bg-(color:--green-a3) inline-block rounded-full p-1">
                                                <ArrowUp className="size-icon" />
                                            </span>
                                        </span>
                                    }
                                >
                                    <TypeReferenceDefinitions
                                        serialize={serialize}
                                        shape={publishMessageShape}
                                        types={types}
                                    />
                                </EndpointSection>
                            </TypeDefinitionAnchorPart>
                        )}
                        {subscribeMessages.length > 0 && (
                            <TypeDefinitionAnchorPart part="receive">
                                <EndpointSection
                                    title={
                                        <span className="inline-flex items-center gap-2">
                                            {i18n.playground.receive}
                                            <span className="text-(color:--accent-a12) bg-(color:--accent-a3) inline-block rounded-full p-1">
                                                <ArrowDown className="size-icon" />
                                            </span>
                                        </span>
                                    }
                                >
                                    <TypeReferenceDefinitions
                                        serialize={serialize}
                                        shape={subscribeMessageShape}
                                        types={types}
                                    />
                                </EndpointSection>
                            </TypeDefinitionAnchorPart>
                        )}
                    </TypeDefinitionSlotsServer>
                </TypeDefinitionRoot>
            }
            footer={<FooterLayout bottomNavigation={bottomNavigation} hideFeedback={hideFeedback} />}
        >
            <PlaygroundKeyboardTrigger />
            <MdxServerComponentProseSuspense serialize={serialize} mdx={channel.description} />
        </ReferenceLayout>
    );
}

function flattenWebSocketShape(
    subscribeMessages: ApiDefinition.WebSocketMessage[],
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
) {
    return subscribeMessages.flatMap((message): ApiDefinition.UndiscriminatedUnionVariant[] => {
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
