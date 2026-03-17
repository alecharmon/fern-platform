"use client";

import { EMPTY_OBJECT } from "@fern-api/ui-core-utils";
import { useDeepCompareMemoize } from "@fern-ui/react-commons";
import { forwardRef, useMemo } from "react";

import { useIsPrintMode } from "../state/print-mode";
import { FernSyntaxHighlighterTokens, type ScrollToHandle } from "./FernSyntaxHighlighterTokens";
import { FernSyntaxHighlighterTokensVirtualized } from "./FernSyntaxHighlighterTokensVirtualized";
import { createRawTokens, highlightTokens, useHighlighter } from "./fernShiki";
import { TemplateTooltip } from "./template-tooltip";

// [number, number] is a range of lines to highlight
type HighlightLine = number | [number, number];

export interface FernSyntaxHighlighterProps {
    className?: string;
    style?: React.CSSProperties;
    id?: string;
    code: string;
    language: string;
    fontSize?: "sm" | "base" | "lg";
    highlightLines?: HighlightLine[];
    highlightStyle?: "highlight" | "focus";
    viewportRef?: React.RefObject<ScrollToHandle | null>;
    maxLines?: number;
    wordWrap?: boolean;
    template?: Record<string, string>;
    tooltips?: Record<string, React.ReactNode>;
    links?: Record<string, string>;
    /**
     * Whether to show line numbers in the gutter
     * @default true
     */
    showLineNumbers?: boolean;
    /**
     * Whether to hide all line prefixes (numbers AND $/>)
     * @default false
     */
    hideLinePrefixes?: boolean;
}

export const FernSyntaxHighlighter = forwardRef<HTMLPreElement, FernSyntaxHighlighterProps>((props, ref) => {
    const { code, language, tooltips, template, links, ...innerProps } = props;
    const highlighter = useHighlighter(language);
    const isPrintMode = useIsPrintMode();

    const variableNames = useDeepCompareMemoize(
        new Set([...Object.keys(tooltips ?? EMPTY_OBJECT), ...Object.keys(template ?? EMPTY_OBJECT)])
    );

    const tokens = useMemo(() => {
        if (highlighter == null) {
            return createRawTokens(code, language);
        }
        try {
            return highlightTokens(highlighter, code, language, variableNames);
        } catch (e) {
            // TODO: sentry

            console.error("Error occurred while highlighting tokens", e);
            return createRawTokens(code, language);
        }
    }, [code, highlighter, language, variableNames]);

    const { maxLines } = innerProps;

    const lines = code.split("\n").length;

    const TokenRenderer =
        isPrintMode || (maxLines != null && lines <= maxLines + 100) || lines <= 500 || maxLines == null
            ? FernSyntaxHighlighterTokens
            : FernSyntaxHighlighterTokensVirtualized;

    return (
        <TemplateTooltip.Provider value={tooltips ?? EMPTY_OBJECT}>
            <TokenRenderer
                ref={ref}
                tokens={tokens}
                template={template}
                links={links}
                {...innerProps}
                highlighted={highlighter != null}
            />
        </TemplateTooltip.Provider>
    );
});

FernSyntaxHighlighter.displayName = "FernSyntaxHighlighter";
