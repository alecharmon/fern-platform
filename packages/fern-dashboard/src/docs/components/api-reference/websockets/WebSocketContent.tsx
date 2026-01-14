"use client";

/**
 * Dashboard-specific WebSocketContent (client-side, read-only).
 *
 * Main component for rendering WebSocket API reference pages.
 * Uses ReferenceLayout with header, handshake example, and message sections.
 * Excludes: playground integration.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/websockets/WebSocket.tsx
 */

import { removeTrailingSlash } from "@fern-api/docs-utils";
import type { WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { EndpointSection } from "@fern-docs/components/api-reference/endpoints/EndpointSection";
import { EndpointUrlWithOverflow } from "@fern-docs/components/api-reference/endpoints/EndpointUrlWithOverflow";
import { TitledExample } from "@fern-docs/components/api-reference/examples/TitledExample";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionRoot
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { CardedSection } from "@fern-docs/components/api-reference/websockets/CardedSection";
import {
    type WebSocketMessage,
    WebSocketMessages
} from "@fern-docs/components/api-reference/websockets/WebSocketMessages";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { FernBreadcrumbs } from "@fern-docs/components/FernBreadcrumbs";
import { FernScrollArea } from "@fern-docs/components/FernScrollArea";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import { t } from "@fern-docs/i18n";
import { ArrowDown, ArrowUp, Wifi } from "lucide-react";
import { useMemo } from "react";

import { MouseFollowingTooltip } from "@/components/editor/MouseFollowingTooltip";
import { MdxContent } from "@/docs/mdx/components/MdxContent";
import { useApiEditTarget } from "@/providers/ApiEditTargetContext";
import { type DescriptionTarget, useDescriptionEditability } from "@/providers/OpenApiSpecsContext";
import { ObjectProperty } from "../type-definitions/ObjectProperty";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

/**
 * Editable description for WebSocket channels.
 * Shows edit-disabled indicator since WebSocket editing is not yet supported.
 */
function EditableWebSocketDescription({ description }: { description: string | undefined }) {
    const apiEditTarget = useApiEditTarget();

    // Build WebSocket description target
    const target = useMemo((): DescriptionTarget | null => {
        if (!apiEditTarget || apiEditTarget.type !== "websocket") {
            return null;
        }
        return {
            type: "websocket",
            path: apiEditTarget.path
        };
    }, [apiEditTarget]);

    const { reason } = useDescriptionEditability(target);

    // If no edit target, just render MdxContent
    if (!target) {
        return <MdxContent mdx={description} />;
    }

    // When no description, nothing to show (WebSocket is not editable)
    if (!description) {
        return null;
    }

    // With description, wrap in mouse-following tooltip
    return (
        <MouseFollowingTooltip reason={reason}>
            <MdxContent mdx={description} />
        </MouseFollowingTooltip>
    );
}

export interface WebSocketContentProps {
    context: WebSocketContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
}

export function WebSocketContent({ context, breadcrumb, lang }: WebSocketContentProps) {
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

    const headers = [...globalHeaders, ...(channel.requestHeaders ?? [])];
    const baseUrl = channel.environments?.[0]?.baseUrl;

    return (
        <ReferenceLayout
            header={
                <WebSocketPageHeader
                    breadcrumb={breadcrumb}
                    title={node.title}
                    availability={channel.availability}
                    channel={channel}
                    baseUrl={baseUrl}
                    lang={lang}
                />
            }
            aside={
                <div className="not-prose grid grid-rows-[repeat(auto-fit,minmax(0,min-content))] gap-6">
                    <TitledExample title={t(lang).apiReference.handshake} disableClipboard={true} lang={lang}>
                        <FernScrollArea className="rounded-b-[inherit]" rootClassName="rounded-b-[inherit]">
                            <HandshakeExample channel={channel} example={example} baseUrl={baseUrl} lang={lang} />
                        </FernScrollArea>
                    </TitledExample>
                    {exampleMessages.length > 0 && (
                        <TitledExample title={t(lang).apiReference.messages} className="min-h-0 shrink" lang={lang}>
                            <FernScrollArea className="rounded-b-[inherit]" rootClassName="rounded-b-[inherit]">
                                <WebSocketMessages messages={exampleMessages} lang={lang} />
                            </FernScrollArea>
                        </TitledExample>
                    )}
                </div>
            }
            reference={
                <TypeDefinitionRoot types={types} slug={node.slug}>
                    <TypeDefinitionSlotsServer types={types} lang={lang}>
                        <CardedSection
                            number={1}
                            title={
                                <span className="flex w-full items-center justify-between">
                                    <span className="inline-flex items-center gap-2">
                                        {t(lang).apiReference.handshake}
                                        <span className="bg-(color:--grayscale-a3) inline-block rounded-full p-1">
                                            <Wifi
                                                className="text-(color:--grayscale-a11) size-icon"
                                                strokeWidth={1.5}
                                            />
                                        </span>
                                    </span>
                                </span>
                            }
                            slug={node.slug}
                            headingElement={
                                <div className="border-border-default rounded-3 -mx-2 flex items-center justify-between border px-2 py-1 transition-colors">
                                    <EndpointUrlWithOverflow
                                        path={channel.path}
                                        method="WSS"
                                        environmentId={undefined}
                                        baseUrl={baseUrl}
                                        showEnvironment={true}
                                        lang={lang}
                                    />
                                    <CopyToClipboardButton
                                        className="-mr-1"
                                        content={() =>
                                            `${removeTrailingSlash(baseUrl ?? "")}${ApiDefinition.toColonEndpointPathLiteral(channel.path)}`
                                        }
                                        lang={lang}
                                    />
                                </div>
                            }
                        >
                            <TypeDefinitionAnchorPart part="request">
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
                                                {channel.queryParameters.map((parameter) => (
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
                                    <TypeReferenceDefinitions shape={publishMessageShape} types={types} lang={lang} />
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
                                    <TypeReferenceDefinitions shape={subscribeMessageShape} types={types} lang={lang} />
                                </EndpointSection>
                            </TypeDefinitionAnchorPart>
                        )}
                    </TypeDefinitionSlotsServer>
                </TypeDefinitionRoot>
            }
        >
            <EditableWebSocketDescription description={channel.description} />
        </ReferenceLayout>
    );
}

/**
 * Simplified page header for dashboard (no page actions, no playground)
 */
function WebSocketPageHeader({
    breadcrumb,
    title,
    availability,
    channel,
    baseUrl,
    lang
}: {
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    title: string;
    availability: ApiDefinition.Availability | undefined;
    channel: ApiDefinition.WebSocketChannel;
    baseUrl: string | undefined;
    lang: string;
}) {
    return (
        <header className="my-8 space-y-2">
            {breadcrumb.length > 0 && (
                <div className="flex justify-between">
                    <FernBreadcrumbs breadcrumb={breadcrumb} />
                </div>
            )}

            <div className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-row items-center gap-4">
                    <h1 className="fern-page-heading text-balance break-words">{title}</h1>
                    {availability && <AvailabilityBadge availability={availability} rounded />}
                </div>
            </div>

            <EndpointUrlWithOverflow
                path={channel.path}
                method="WSS"
                environmentId={undefined}
                baseUrl={baseUrl}
                showEnvironment={true}
                className="hidden lg:flex"
                lang={lang}
            />
        </header>
    );
}

/**
 * Simplified handshake example for dashboard (no playground base URL hook)
 */
function HandshakeExample({
    channel,
    example,
    baseUrl,
    lang
}: {
    channel: ApiDefinition.WebSocketChannel;
    example: ApiDefinition.ExampleWebSocketSession | undefined;
    baseUrl: string | undefined;
    lang: string;
}) {
    return (
        <div className="flex px-1 py-3">
            <table className="text-body min-w-0 flex-1 shrink table-fixed border-separate border-spacing-x-2 whitespace-normal break-words font-mono text-sm">
                <tbody>
                    <tr>
                        <td className="text-left align-top">{t(lang).apiReference.url}</td>
                        <td className="text-left align-top">
                            {`${removeTrailingSlash(baseUrl ?? "")}${example?.path ?? ApiDefinition.toColonEndpointPathLiteral(channel.path)}`}
                        </td>
                    </tr>
                    <tr>
                        <td className="text-left align-top">{t(lang).apiReference.method}</td>
                        <td className="text-left align-top">{t(lang).httpMethods.get}</td>
                    </tr>
                    <tr>
                        <td className="text-left align-top">{t(lang).apiReference.status}</td>
                        <td className="text-left align-top">{t(lang).status.switchingProtocols}</td>
                    </tr>
                </tbody>
            </table>
        </div>
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
