"use client";

import { parseStringStyle, visit } from "@fern-docs/mdx";

import { isEqual } from "es-toolkit/predicate";
import type { Element } from "hast";
import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from "react";
import { cn } from "../cn";
import { FernScrollArea } from "../FernScrollArea";
import type { HighlightedTokens } from "./fernShiki";
import { HastToJSX } from "./HastToJsx";
import { flattenHighlightLines, getMaxHeight, getTextContent, type HighlightLine } from "./utils";

export interface ScrollToHandle {
    scrollTo: (options: ScrollToOptions) => void;
    scrollToLast: (options?: ScrollOptions) => void;
    scrollToLine: (line: number) => void;
    clientHeight: number;
    scrollHeight: number;
}

export interface FernSyntaxHighlighterTokensProps {
    tokens: HighlightedTokens;
    fontSize?: "sm" | "base" | "lg";
    highlightLines?: HighlightLine[];
    highlightStyle?: "highlight" | "focus";

    className?: string;
    id?: string;
    style?: React.CSSProperties;
    viewportRef?: React.RefObject<ScrollToHandle | null>;
    maxLines?: number;
    wordWrap?: boolean;
    template?: Record<string, string>;
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

export function fernSyntaxHighlighterTokenPropsAreEqual(
    prevProps: FernSyntaxHighlighterTokensProps,
    nextProps: FernSyntaxHighlighterTokensProps
): boolean {
    return (
        isEqual(prevProps.highlightLines, nextProps.highlightLines) &&
        isEqual(prevProps.style, nextProps.style) &&
        prevProps.fontSize === nextProps.fontSize &&
        prevProps.highlightStyle === nextProps.highlightStyle &&
        prevProps.className === nextProps.className &&
        prevProps.maxLines === nextProps.maxLines &&
        prevProps.tokens === nextProps.tokens &&
        prevProps.wordWrap === nextProps.wordWrap &&
        prevProps.showLineNumbers === nextProps.showLineNumbers &&
        prevProps.hideLinePrefixes === nextProps.hideLinePrefixes
    );
}

export const FernSyntaxHighlighterTokens = memo(
    forwardRef<HTMLPreElement, FernSyntaxHighlighterTokensProps>((props, ref) => {
        const {
            className,
            style,
            fontSize = "base",
            highlightLines,
            highlightStyle,
            viewportRef,
            tokens,
            maxLines,
            wordWrap,
            template,
            links,
            id,
            showLineNumbers = true,
            hideLinePrefixes = false
        } = props;
        const scrollAreaRef = useRef<HTMLDivElement>(null);

        useImperativeHandle<ScrollToHandle, ScrollToHandle>(
            viewportRef,
            (): ScrollToHandle => ({
                scrollTo(options) {
                    if (scrollAreaRef.current) {
                        scrollAreaRef.current?.scrollTo(options);
                    }
                },
                scrollToLast(options) {
                    if (scrollAreaRef.current) {
                        scrollAreaRef.current?.scrollTo({
                            top: scrollAreaRef.current.scrollHeight - scrollAreaRef.current.clientHeight,
                            ...options
                        });
                    }
                },
                scrollToLine(lineNumber) {
                    if (scrollAreaRef.current) {
                        const scrollArea = scrollAreaRef.current;

                        const firstLineElement = scrollArea.querySelector(".code-block-line");
                        if (!firstLineElement || !(firstLineElement instanceof HTMLElement)) {
                            return;
                        }

                        scrollArea.scrollTo({
                            top: Math.max(0, lineNumber * firstLineElement.offsetHeight),
                            behavior: "smooth"
                        });
                    }
                },
                get clientHeight() {
                    return scrollAreaRef.current?.clientHeight ?? 0;
                },
                get scrollHeight() {
                    return scrollAreaRef.current?.scrollHeight ?? 0;
                }
            })
        );

        const preStyle = useMemo(() => {
            let preStyle = {};

            visit(tokens.hast, "element", (node) => {
                if (node.tagName === "pre") {
                    preStyle = parseStringStyle(node.properties.style) ?? {};
                    return false; // stop traversing
                }
                return true;
            });
            return preStyle;
        }, [tokens.hast]);

        const highlightedLines = useMemo(() => flattenHighlightLines(highlightLines ?? []), [highlightLines]);
        const lines = useMemo(() => {
            const lines: Element[] = [];
            visit(tokens.hast, "element", (node) => {
                if (node.tagName === "code") {
                    node.children.forEach((child) => {
                        if (child.type === "element" && child.tagName === "span") {
                            lines.push(child);
                        }
                    });
                }
            });
            return lines;
        }, [tokens.hast]);

        const lang = tokens.lang;
        const gutterCli = lang === "cli" || lang === "shell" || lang === "bash";
        const plaintext = tokens.lang === "plaintext" || tokens.lang === "text" || tokens.lang === "txt";
        const shouldShowGutter = !plaintext && showLineNumbers && !hideLinePrefixes;

        return (
            <pre
                className={cn("code-block-root not-prose", className)}
                style={{ ...style, ...preStyle }}
                ref={ref}
                tabIndex={0}
                id={id}
            >
                <FernScrollArea ref={scrollAreaRef} style={{ maxHeight: getMaxHeight(fontSize, maxLines) }}>
                    <div
                        className={cn("code-block", {
                            "text-xs": fontSize === "sm",
                            "text-sm": fontSize === "base",
                            "text-base": fontSize === "lg"
                        })}
                    >
                        <div className="code-block-inner">
                            <table
                                className={cn("code-block-line-group", {
                                    "highlight-focus": highlightStyle === "focus" && highlightedLines.length > 0,
                                    "word-wrap": wordWrap
                                })}
                            >
                                {shouldShowGutter && (
                                    <colgroup>
                                        <col className="w-fit" />
                                        <col />
                                    </colgroup>
                                )}
                                <tbody>
                                    {lines.map((line, lineNumber) => {
                                        let gutterSymbol: string | number;
                                        if (gutterCli) {
                                            if (lineNumber === 0) {
                                                gutterSymbol = "$";
                                            } else {
                                                const prevLine = lines[lineNumber - 1];
                                                const prevLineText = prevLine != null ? getTextContent(prevLine) : "";
                                                gutterSymbol = prevLineText.trimEnd().endsWith("\\") ? ">" : "$";
                                            }
                                        } else {
                                            gutterSymbol = lineNumber + 1;
                                        }
                                        return (
                                            <tr
                                                className={cn("code-block-line", {
                                                    highlight: highlightedLines.includes(lineNumber)
                                                })}
                                                key={lineNumber}
                                            >
                                                {shouldShowGutter && (
                                                    <td className="code-block-line-gutter">
                                                        <span>{gutterSymbol}</span>
                                                    </td>
                                                )}
                                                <td className="code-block-line-content">
                                                    <HastToJSX hast={line} template={template} links={links} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </FernScrollArea>
            </pre>
        );
    }),
    fernSyntaxHighlighterTokenPropsAreEqual
);

FernSyntaxHighlighterTokens.displayName = "FernSyntaxHighlighterTokens";
