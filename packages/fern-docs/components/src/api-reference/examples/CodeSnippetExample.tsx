"use client";

import { useResizeObserver } from "@fern-ui/react-commons";
import { isEqual } from "es-toolkit/predicate";
import React, { createRef, type FC, useCallback, useEffect, useMemo } from "react";
import { cn } from "../../cn";
import { useErrorBoundary } from "../../providers/ErrorBoundaryProvider";
import { FernSyntaxHighlighter, type ScrollToHandle } from "../../syntax-highlighter";
import type { JsonPropertyPath } from "./JsonPropertyPath";
import { TitledExample } from "./TitledExample";
import { useHighlightJsonLines } from "./useHighlightJsonLines";

export declare namespace CodeSnippetExample {
    export interface Props extends Omit<TitledExample.Props, "copyToClipboardText"> {
        id?: string;
        code: string;
        language: string;
        json: unknown;
        jsonStartLine?: number;
        scrollAreaStyle?: React.CSSProperties;
        measureHeight?: (height: number) => void;
        slug?: string;
        isResponse?: boolean;
    }
}

const CodeSnippetExampleInternal: FC<CodeSnippetExample.Props> = ({
    id,
    code,
    language,
    json,
    jsonStartLine,
    scrollAreaStyle,
    measureHeight,
    className,
    slug,
    isResponse = false,
    ...props
}) => {
    const codeBlockRef = createRef<HTMLPreElement>();
    const viewportRef = createRef<ScrollToHandle>();

    useResizeObserver(codeBlockRef, ([entry]) => {
        if (entry != null) {
            measureHeight?.(entry.contentRect.height);
        }
    });

    const [hoveredPropertyPath, setHoveredPropertyPath] = React.useState<JsonPropertyPath | undefined>(undefined);

    React.useEffect(() => {
        if (slug == null) {
            return;
        }
        const propertyHoverOnEventName = `property-hover-on:${slug}:${isResponse ? "response" : "request"}`;
        const propertyHoverOffEventName = `property-hover-off:${slug}:${isResponse ? "response" : "request"}`;
        const hoverOnHandler = (event: Event) => {
            if (event instanceof CustomEvent) {
                const detail = event.detail as JsonPropertyPath;
                setHoveredPropertyPath(detail);
            }
        };
        const hoverOffHandler = (event: Event) => {
            if (event instanceof CustomEvent) {
                const detail = event.detail as JsonPropertyPath;
                setHoveredPropertyPath((prev) => (isEqual(prev, detail) ? undefined : prev));
            }
        };
        window.addEventListener(propertyHoverOnEventName, hoverOnHandler);
        window.addEventListener(propertyHoverOffEventName, hoverOffHandler);
        return () => {
            window.removeEventListener(propertyHoverOnEventName, hoverOnHandler);
            window.removeEventListener(propertyHoverOffEventName, hoverOffHandler);
        };
    }, [slug, isResponse]);

    const requestHighlightLines = useHighlightJsonLines(json, hoveredPropertyPath, jsonStartLine);

    useEffect(() => {
        if (viewportRef.current != null && requestHighlightLines[0] != null) {
            const lineNumber = Array.isArray(requestHighlightLines[0])
                ? requestHighlightLines[0][0]
                : requestHighlightLines[0];
            const offsetTop = (lineNumber - 1) * 19.5 - viewportRef.current.clientHeight / 4;
            viewportRef.current.scrollTo({
                top: offsetTop,
                behavior: "smooth"
            });
        }
    }, [requestHighlightLines, viewportRef]);

    // Scroll to top when code changes
    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when code changes
    useEffect(() => {
        viewportRef.current?.scrollTo({ top: 0 });
    }, [code]);

    return (
        <TitledExample
            copyToClipboardText={useCallback(() => code, [code])}
            {...props}
            className={cn(className, isResponse ? "fern-endpoint-response-snippet" : "fern-endpoint-request-snippet")}
        >
            <FernSyntaxHighlighter
                id={id}
                className="rounded-b-[inherit] rounded-t-none"
                ref={codeBlockRef}
                style={scrollAreaStyle}
                viewportRef={viewportRef}
                language={language}
                fontSize="sm"
                highlightLines={requestHighlightLines}
                code={code}
            />
        </TitledExample>
    );
};

export const CodeSnippetExample: FC<CodeSnippetExample.Props> = (props) => {
    const ErrorBoundary = useErrorBoundary();
    return (
        <ErrorBoundary>
            <CodeSnippetExampleInternal {...props} />
        </ErrorBoundary>
    );
};

export declare namespace JsonCodeSnippetExample {
    export interface Props extends Omit<CodeSnippetExample.Props, "language" | "jsonStartLine" | "code"> {}
}

export const JsonCodeSnippetExample: FC<JsonCodeSnippetExample.Props> = (props) => {
    const code = useMemo(() => JSON.stringify(props.json, null, 2), [props.json]);
    return <CodeSnippetExample {...props} language="json" code={code} />;
};
