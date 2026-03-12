import "server-only";

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { WebSocketContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { TitledExample } from "@fern-docs/components/api-reference/examples/TitledExample";
import { TypeDefinitionRoot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import {
    type WebSocketMessage,
    WebSocketMessages
} from "@fern-docs/components/api-reference/websockets/WebSocketMessages";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { FernScrollArea } from "@fern-docs/components/FernScrollArea";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import { t } from "@fern-docs/i18n";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { PageHeader } from "@/components/PageHeader";
import { PlaygroundKeyboardTrigger } from "@/components/playground/PlaygroundKeyboardTrigger";
import { extractFooterContent } from "@/mdx/components/footer/extract-footer-content";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";
import { serializeApiDescriptionsWithBatchCache } from "@/server/remote-renderer/batch-cache-api-descriptions";
import { getRemoteMDXRenderingConfig } from "@/server/remote-renderer/feature-flags";
import { PlaygroundButtonTray } from "../../playground/PlaygroundButtonTray";
import { ApiReferenceClientWrapper } from "../ApiReferenceClientWrapper";
import { EndpointUrlWithPlaygroundBaseUrl } from "../endpoints/EndpointUrlWithPlaygroundBaseUrl";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { HandshakeExample } from "./HandshakeExample";
import { WebSocketContentLeft } from "./WebSocketContentLeft";

export async function WebSocketContent({
    serialize,
    context,
    breadcrumb,
    bottomNavigation,
    action,
    hideFeedback,
    pageActionOptions,
    markdownPromise,
    lang,
    pageActionsStyle = "default",
    theme,
    showUnionsAsDropdown = false
}: {
    serialize: MdxSerializer;
    context: WebSocketContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation: React.ReactNode;
    action?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdownPromise: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
    lang: string;
    pageActionsStyle?: "default" | "toolbar";
    theme?: FernThemeConfig;
    showUnionsAsDropdown?: boolean;
}) {
    const { channel, node, types } = context;
    const { enabled: useRemoteRendering } = getRemoteMDXRenderingConfig();

    // Pre-serialize all API type descriptions with batch-level caching
    const serializedTypes = useRemoteRendering ? await serializeApiDescriptionsWithBatchCache(types, node.slug) : types;

    // Extract footer content from the description
    const { description: descriptionWithoutFooter, footerContent } = extractFooterContent(channel.description);

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
                displayName: messageDefinition?.displayName ?? undefined
            };
        }) ?? [];

    return (
        <ReferenceLayout
            theme={theme}
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
                    lang={lang}
                    pageActionsStyle={pageActionsStyle}
                >
                    <ApiReferenceClientWrapper apiDefinitionId={node.apiDefinitionId}>
                        <EndpointUrlWithPlaygroundBaseUrl
                            endpoint={channel}
                            className="hidden lg:flex"
                            method="WSS"
                            lang={lang}
                        />
                    </ApiReferenceClientWrapper>
                </PageHeader>
            }
            aside={
                <ApiReferenceClientWrapper apiDefinitionId={node.apiDefinitionId}>
                    <div className="not-prose w-full grid auto-rows-[minmax(0,min-content)] gap-6">
                        <TitledExample
                            title={t(lang).apiReference.handshake}
                            tryIt={
                                node != null ? (
                                    <PlaygroundButtonTray state={node} endpoint={channel} lang={lang} />
                                ) : undefined
                            }
                            disableClipboard={true}
                            lang={lang}
                        >
                            <FernScrollArea className="rounded-b-[inherit]" rootClassName="rounded-b-[inherit]">
                                <HandshakeExample channel={channel} example={example} lang={lang} />
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
                </ApiReferenceClientWrapper>
            }
            reference={
                <TypeDefinitionRoot types={serializedTypes} slug={node.slug}>
                    <TypeDefinitionSlotsServer
                        types={serializedTypes}
                        lang={lang}
                        showUnionsAsDropdown={showUnionsAsDropdown}
                    >
                        <WebSocketContentLeft
                            context={context}
                            lang={lang}
                            showUnionsAsDropdown={showUnionsAsDropdown}
                        />
                    </TypeDefinitionSlotsServer>
                </TypeDefinitionRoot>
            }
            descriptionFooter={
                footerContent ? (
                    <MdxServerComponentProseSuspense key="description-footer" mdx={footerContent} />
                ) : undefined
            }
            footer={<FooterLayout bottomNavigation={bottomNavigation} hideFeedback={hideFeedback} lang={lang} />}
        >
            <PlaygroundKeyboardTrigger />
            <MdxServerComponentProseSuspense mdx={descriptionWithoutFooter} />
        </ReferenceLayout>
    );
}
