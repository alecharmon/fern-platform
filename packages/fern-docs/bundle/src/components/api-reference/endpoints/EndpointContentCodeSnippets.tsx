"use client";

import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { CodeExampleClientDropdown } from "@fern-docs/components/api-reference/endpoints/CodeExampleClientDropdown";
import { useEndpointContext } from "@fern-docs/components/api-reference/endpoints/EndpointContext";
import { EndpointExampleSegmentedControl } from "@fern-docs/components/api-reference/endpoints/EndpointExampleSegmentedControl";
import { EndpointUrlWithOverflow } from "@fern-docs/components/api-reference/endpoints/EndpointUrlWithOverflow";
import { ErrorExampleSelect } from "@fern-docs/components/api-reference/endpoints/ErrorExampleSelect";
import { renderResponseTitle } from "@fern-docs/components/api-reference/endpoints/render-response-title";
import {
    getErrorByStatusCode,
    resolveEnvironmentUrlInCodeSnippet
} from "@fern-docs/components/api-reference/endpoints/utils";
import { AudioExample } from "@fern-docs/components/api-reference/examples/AudioExample";
import {
    CodeSnippetExample,
    JsonCodeSnippetExample
} from "@fern-docs/components/api-reference/examples/CodeSnippetExample";
import type { CodeExample } from "@fern-docs/components/api-reference/examples/code-example";
import { TitledExample } from "@fern-docs/components/api-reference/examples/TitledExample";
import { lineNumberOf } from "@fern-docs/components/api-reference/examples/utils";
import type { StatusCode } from "@fern-docs/components/api-reference/type-definitions/EndpointContent";
import { WebSocketMessages } from "@fern-docs/components/api-reference/websockets/WebSocketMessages";
import { statusCodeToIntent } from "@fern-docs/components/badges/status-code-badge";
import { cn } from "@fern-docs/components/cn";
import { FernScrollArea } from "@fern-docs/components/FernScrollArea";
import { t } from "@fern-docs/i18n";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import { PlaygroundButtonTray } from "../../playground/PlaygroundButtonTray";
import { usePlaygroundBaseUrl } from "../../playground/utils/select-environment";

export declare namespace EndpointContentCodeSnippets {
    export interface Props {
        node: FernNavigation.EndpointNode;
        endpoint: ApiDefinition.EndpointDefinition;
        showErrors: boolean;
        className?: string;
        lang: string;
    }
}

const UnmemoizedEndpointContentCodeSnippets: React.FC<EndpointContentCodeSnippets.Props> = ({
    node,
    endpoint,
    showErrors,
    className,
    lang
}) => {
    const {
        selectedExample,
        examplesByStatusCode,
        selectedExampleKey,
        availableLanguages,
        availableLanguagesByStatusCode,
        setSelectedExampleKey,
        segmentedControlExamples
    } = useEndpointContext();

    const languages =
        selectedExampleKey.statusCode != null
            ? (availableLanguagesByStatusCode[selectedExampleKey.statusCode] ?? availableLanguages)
            : availableLanguages;

    const handleSelectExample = useCallback(
        (statusCode: StatusCode, responseIndex: number) => {
            setSelectedExampleKey((prev) => ({
                ...prev,
                statusCode,
                responseIndex
            }));
        },
        [setSelectedExampleKey]
    );

    const errorByStatusCode = useMemo(() => getErrorByStatusCode(endpoint.errors), [endpoint.errors]);

    const getExampleId = useCallback(
        (example: CodeExample | undefined) => {
            switch (example?.exampleCall.responseBody?.type) {
                case "json":
                case "filename": {
                    if (endpoint.protocol?.type === "grpc") {
                        return t(lang).apiReference.exampleResponse;
                    }
                    const title =
                        example.exampleCall.name ??
                        ApiDefinition.getMessageForStatus(example.exampleCall.responseStatusCode, endpoint.method) ??
                        t(lang).apiReference.response;
                    const error = errorByStatusCode[example.exampleCall.responseStatusCode];
                    return renderResponseTitle(
                        title,
                        example.exampleCall.responseStatusCode,
                        undefined,
                        error?.isWildcard
                    );
                }
                case "stream":
                    return t(lang).playground.streamedResponse;
                case "sse":
                    return t(lang).playground.serverSentEvents;
                default:
                    return t(lang).apiReference.response;
            }
        },
        [endpoint.method, endpoint.protocol?.type, lang, errorByStatusCode]
    );

    const errorSelector =
        showErrors &&
        (Object.keys(examplesByStatusCode).length > 1 ||
            Object.values(examplesByStatusCode).some((examples) => examples.length > 1)) ? (
            <ErrorExampleSelect
                examplesByStatusCode={examplesByStatusCode}
                selectedExample={selectedExample}
                setSelectedExampleKey={handleSelectExample}
                getExampleId={getExampleId}
            />
        ) : (
            <span className="text-(color:--grayscale-a11) text-sm min-w-0">{getExampleId(selectedExample)}</span>
        );

    const [baseUrl, environmentId] = usePlaygroundBaseUrl(endpoint, node.apiDefinitionId);

    // segmentedControlExamples is now calculated in useExampleSelection and provided via context
    // This ensures the tabs and the selected example are always in sync

    return (
        <div
            className={cn(
                "not-prose",
                // note: .fern-endpoint-code-snippets class is used to detect clicks outside of the code snippets
                // this is used to clear the selected error when the user clicks outside of the error
                "fern-endpoint-code-snippets w-full",
                // this is used to ensure that two long code snippets will take up the same height,
                // but if one is shorter the other snippet will take up the remaining space
                "grid grid-rows-[repeat(auto-fit,minmax(0,min-content))] gap-6",
                className
            )}
        >
            {segmentedControlExamples.length > 1 && (
                <EndpointExampleSegmentedControl
                    segmentedControlExamples={segmentedControlExamples}
                    selectedExample={selectedExample}
                    onSelectExample={(exampleKey) => {
                        setSelectedExampleKey((prev) => {
                            if (prev.exampleKey === exampleKey) {
                                return prev;
                            }
                            return { ...prev, exampleKey };
                        });
                    }}
                    lang={lang}
                />
            )}
            {endpoint.protocol?.type === "grpc" ? (
                <JsonCodeSnippetExample
                    title={t(lang).apiReference.exampleRequest}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                    json={endpoint.examples?.[0]?.requestBody?.value}
                    slug={node?.slug ?? ""}
                    isResponse={false}
                    lang={lang}
                />
            ) : (
                <CodeSnippetExample
                    title={
                        <EndpointUrlWithOverflow
                            path={endpoint.path}
                            method={endpoint.method}
                            environmentId={environmentId}
                            baseUrl={baseUrl}
                            hideCopyButton={true}
                            lang={lang}
                        />
                    }
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                    tryIt={<>{node != null && <PlaygroundButtonTray state={node} endpoint={endpoint} lang={lang} />}</>}
                    languageDropdown={
                        <>
                            {languages.length > 1 && (
                                <CodeExampleClientDropdown
                                    languages={languages}
                                    value={selectedExampleKey.language}
                                    onValueChange={(language) => {
                                        setSelectedExampleKey((prev) => ({
                                            ...prev,
                                            language
                                        }));
                                    }}
                                    lang={lang}
                                />
                            )}
                        </>
                    }
                    code={resolveEnvironmentUrlInCodeSnippet(endpoint, selectedExample?.code ?? "", baseUrl)}
                    language={selectedExampleKey.language}
                    json={selectedExample?.exampleCall.requestBody?.value}
                    jsonStartLine={
                        selectedExampleKey.language === "curl"
                            ? lineNumberOf(selectedExample?.code ?? "", "-d '{")
                            : undefined
                    }
                    slug={node?.slug}
                    isResponse={false}
                    lang={lang}
                />
            )}
            {selectedExample != null && selectedExample.exampleCall.responseStatusCode >= 400 && (
                <JsonCodeSnippetExample
                    title={errorSelector}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                    json={selectedExample?.exampleCall.responseBody?.value}
                    intent={statusCodeToIntent(String(selectedExample.exampleCall.responseStatusCode))}
                    slug={node?.slug ?? ""}
                    isResponse={true}
                    lang={lang}
                />
            )}
            {selectedExample?.exampleCall.responseBody != null &&
                selectedExample.exampleCall.responseStatusCode >= 200 &&
                selectedExample.exampleCall.responseStatusCode < 300 &&
                visitDiscriminatedUnion(selectedExample.exampleCall.responseBody)._visit<ReactNode>({
                    json: (value) => (
                        <JsonCodeSnippetExample
                            title={errorSelector}
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                            json={value.value}
                            slug={node?.slug ?? ""}
                            isResponse={true}
                            lang={lang}
                        />
                    ),
                    // TODO: support other media types
                    filename: () => <AudioExample title={errorSelector} lang={lang} />,
                    stream: (value) => (
                        <TitledExample title={errorSelector} lang={lang}>
                            <FernScrollArea className="rounded-b-[inherit]">
                                <WebSocketMessages
                                    messages={value.value.map((event) => ({
                                        type: undefined,
                                        origin: undefined,
                                        displayName: undefined,
                                        data: {
                                            type: "json",
                                            data: event
                                        }
                                    }))}
                                    lang={lang}
                                />
                            </FernScrollArea>
                        </TitledExample>
                    ),
                    sse: (value) => (
                        <TitledExample title={errorSelector} lang={lang}>
                            <FernScrollArea className="rounded-b-[inherit]">
                                <WebSocketMessages
                                    messages={value.value.map(({ event, data }) => ({
                                        type: event,
                                        origin: undefined,
                                        displayName: undefined,
                                        data: {
                                            type: "sse",
                                            event,
                                            data
                                        }
                                    }))}
                                    lang={lang}
                                />
                            </FernScrollArea>
                        </TitledExample>
                    ),
                    _other: () => {
                        throw new Error("example.responseBody is an unknown type");
                    }
                })}
        </div>
    );
};

export const EndpointContentCodeSnippets = memo(UnmemoizedEndpointContentCodeSnippets);
