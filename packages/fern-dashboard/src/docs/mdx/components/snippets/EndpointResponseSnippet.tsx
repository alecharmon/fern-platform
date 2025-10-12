"use client";

import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { EndpointDefinition } from "@fern-api/fdr-sdk/api-definition";
import { FernSyntaxHighlighter } from "@fern-docs/components/syntax-highlighter";
import { useRef } from "react";
import { TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";

import { EditorPreviewBanner } from "./EditorPreviewBanner";
import { EndpointNotFoundState } from "./EndpointNotFoundState";

/* eslint-disable unused-imports/no-unused-vars */

export const EMPTY_ENDPOINT_RESPONSE_SNIPPET = `
<EndpointResponseSnippet endpoint="" />
`;

export function EndpointResponseSnippet({
    endpoint,
    example,
    endpointDefinition,
    slug,
    className
}: {
    /**
     * The endpoint locator to use for the request snippet.
     */
    endpoint?: string;
    /**
     * The example to use for the request snippet.
     */
    example?: string | undefined;
    /**
     * @internal the rehype-endpoint-examples-snippets plugin will set this
     */
    endpointDefinition?: ApiDefinition.EndpointDefinition;
    /**
     * The slug of the endpoint.
     */
    slug: string;
    className?: string;
}) {
    const { isWithinEditor } = useEditorComponent();
    const snippetRef = useRef<HTMLDivElement>(null);

    if (endpointDefinition == null) {
        const notFoundContent = <EndpointNotFoundState endpointProp={endpoint} snippetRef={snippetRef} />;

        if (isWithinEditor) {
            return (
                <EditorComponentPopoverProvider
                    attributes={{
                        endpoint: new TextInputControl({ defaultValue: endpoint })
                    }}
                    targetRef={snippetRef}
                    buttonAlwaysVisible
                >
                    {notFoundContent}
                </EditorComponentPopoverProvider>
            );
        }

        return notFoundContent;
    }

    return (
        <EndpointResponseSnippetInternal
            endpoint={endpointDefinition}
            example={example}
            slug={slug}
            className={className}
            endpointProp={endpoint}
        />
    );
}

function EndpointResponseSnippetInternal({
    endpoint,
    example,
    slug,
    className,
    endpointProp
}: {
    slug: string;
    endpoint: EndpointDefinition;
    example: string | undefined;
    className?: string;
    endpointProp?: string;
}) {
    const { isWithinEditor } = useEditorComponent();
    const snippetRef = useRef<HTMLDivElement>(null);

    // Find the first example if no specific example is requested
    const selectedExample = endpoint.examples?.[0];

    const responseJson = selectedExample?.responseBody?.value;

    if (responseJson == null) {
        return null;
    }

    const responseJsonString = JSON.stringify(responseJson, null, 2);

    const snippetContent = (
        <div ref={snippetRef} className={className}>
            <div className="bg-card-background border-card-border rounded-3 shadow-card-grayscale relative flex flex-col overflow-hidden border">
                {isWithinEditor && <EditorComponentPopoverButton className="absolute right-2 top-0.5 z-10" />}
                <div className="border-card-border rounded-t-inherit flex min-h-10 items-center justify-between border-b px-2">
                    <div className="text-(color:--grayscale-a11) px-1 text-sm">Response</div>
                </div>
                <FernSyntaxHighlighter
                    className="rounded-b-inherit rounded-t-none"
                    style={{ maxHeight: "500px" }}
                    language="json"
                    fontSize="sm"
                    code={responseJsonString}
                />
                <EditorPreviewBanner name="EndpointResponseSnippet" />
            </div>
        </div>
    );

    if (isWithinEditor) {
        return (
            <EditorComponentPopoverProvider
                attributes={{
                    endpoint: new TextInputControl({ defaultValue: endpointProp })
                }}
                targetRef={snippetRef}
                buttonAlwaysVisible
            >
                {snippetContent}
            </EditorComponentPopoverProvider>
        );
    }

    return snippetContent;
}
