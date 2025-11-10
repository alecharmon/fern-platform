"use client";

import { useCopyToClipboard } from "@fern-ui/react-commons";
import type { Root, RootContent } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import React, { type FC, isValidElement, memo, useContext, useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { cn } from "../cn";
import { FernTooltip } from "../FernTooltip";
import { TemplateTooltip } from "./template-tooltip";

interface HastToJSXProps {
    hast: Root | RootContent;
    template?: Record<string, string>;
    links?: Record<string, string>;
}

interface TokenProps {
    "data-template"?: string;
    children?: React.ReactNode;
    className?: string;
    role?: string;
    onClick?: () => void;
}

/**
 * Recursively extracts all text content from a React element
 */
function extractTextFromElement(element: React.ReactNode): string {
    if (typeof element === "string") {
        return element;
    }
    if (!isValidElement<{ children?: React.ReactNode }>(element)) {
        return "";
    }
    const children = element.props.children;
    if (!children) {
        return "";
    }
    if (typeof children === "string") {
        return children;
    }
    return React.Children.toArray(children).map(extractTextFromElement).join("");
}

/**
 * Extracts text content and child elements from a line element
 */
function extractChildrenInfo(element: React.ReactElement<TokenProps>): {
    children: React.ReactNode[];
    texts: string[];
    fullText: string;
} {
    const children: React.ReactNode[] = [];
    const texts: string[] = [];

    React.Children.forEach(element.props.children, (child) => {
        children.push(child);
        texts.push(
            typeof child === "string" ? child : isValidElement<TokenProps>(child) ? extractTextFromElement(child) : ""
        );
    });

    return {
        children,
        texts,
        fullText: texts.join("")
    };
}

/**
 * Parses a pattern string into a RegExp, supporting both literal strings and regex syntax
 */
function parsePatternToRegex(pattern: string): RegExp {
    // Check if pattern is a regex (format: /pattern/flags)
    if (pattern.startsWith("/")) {
        const lastSlash = pattern.lastIndexOf("/");
        if (lastSlash > 0) {
            try {
                const regexPattern = pattern.slice(1, lastSlash);
                const flags = pattern.slice(lastSlash + 1);
                return new RegExp(regexPattern, flags.includes("g") ? flags : `${flags}g`);
            } catch {
                // Fall through to literal string handling
            }
        }
    }

    // Treat as literal string - escape special regex characters
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escapedPattern, "g");
}

/**
 * Finds all pattern matches in text, avoiding overlaps
 */
function findMatches(
    fullText: string,
    links: Record<string, string>
): { start: number; end: number; url: string; pattern: string }[] {
    const matches: { start: number; end: number; url: string; pattern: string }[] = [];

    // Sort by length descending to match longest patterns first
    const sortedKeys = Object.keys(links).sort((a, b) => b.length - a.length);

    for (const pattern of sortedKeys) {
        const url = links[pattern];
        if (!url) {
            continue;
        }

        const regex = parsePatternToRegex(pattern);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(fullText)) != null) {
            const start = match.index;
            const matchedText = match[0];
            const end = start + matchedText.length;

            // Skip if this match overlaps with an existing match
            const hasOverlap = matches.some(
                (m) => (start >= m.start && start < m.end) || (end > m.start && end <= m.end)
            );

            if (!hasOverlap) {
                matches.push({ start, end, url, pattern: matchedText });
            }
        }
    }

    return matches.sort((a, b) => a.start - b.start);
}

/**
 * Builds a map from character positions to child indices
 */
function buildCharToChildMap(texts: string[]): { childIndex: number; offsetInChild: number }[] {
    const charToChild: { childIndex: number; offsetInChild: number }[] = [];

    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (!text) {
            continue;
        }
        for (let j = 0; j < text.length; j++) {
            charToChild.push({ childIndex: i, offsetInChild: j });
        }
    }

    return charToChild;
}

/**
 * Adds a child element before a match, handling partial splits
 */
function addChildBeforeMatch(
    newChildren: React.ReactNode[],
    childArray: React.ReactNode[],
    texts: string[],
    childIndex: number,
    offsetInChild: number
): void {
    if (offsetInChild === 0) {
        return;
    }

    const child = childArray[childIndex];
    const childText = texts[childIndex];

    if (typeof child === "string") {
        newChildren.push(child.substring(0, offsetInChild));
    } else if (isValidElement<TokenProps>(child) && childText) {
        const beforeText = childText.substring(0, offsetInChild);
        if (beforeText) {
            newChildren.push(React.cloneElement(child, child.props, beforeText));
        }
    }
}

/**
 * Adds a child element after a match, handling partial splits
 */
function addChildAfterMatch(
    newChildren: React.ReactNode[],
    childArray: React.ReactNode[],
    texts: string[],
    childIndex: number,
    offsetInChild: number
): void {
    const child = childArray[childIndex];
    const childText = texts[childIndex];

    if (!childText || offsetInChild >= childText.length - 1) {
        return;
    }

    if (typeof child === "string") {
        const afterText = child.substring(offsetInChild + 1);
        if (afterText) {
            newChildren.push(afterText);
        }
    } else if (isValidElement<TokenProps>(child)) {
        const afterText = childText.substring(offsetInChild + 1);
        if (afterText) {
            newChildren.push(React.cloneElement(child, child.props, afterText));
        }
    }
}

/**
 * Collects child elements that are part of a match
 */
function collectMatchedElements(
    childArray: React.ReactNode[],
    texts: string[],
    startChildIndex: number,
    endChildIndex: number,
    startOffset: number,
    endOffset: number
): React.ReactNode[] {
    const matchedElements: React.ReactNode[] = [];

    for (let i = startChildIndex; i <= endChildIndex; i++) {
        const child = childArray[i];
        const childText = texts[i];
        const isFirstChild = i === startChildIndex;
        const isLastChild = i === endChildIndex;

        if (typeof child === "string") {
            const start = isFirstChild ? startOffset : 0;
            const end = isLastChild ? endOffset + 1 : child.length;
            matchedElements.push(child.substring(start, end));
        } else if (isValidElement<TokenProps>(child) && childText) {
            const start = isFirstChild ? startOffset : 0;
            const end = isLastChild ? endOffset + 1 : childText.length;

            if (start === 0 && end === childText.length) {
                // Include entire child element
                matchedElements.push(child);
            } else {
                // Include partial text from child element
                const partialText = childText.substring(start, end);
                matchedElements.push(React.cloneElement(child, child.props, partialText));
            }
        }
    }

    return matchedElements;
}

/**
 * Wraps matching text patterns across multiple child elements with a single link
 */
function wrapTextWithLinks(element: React.ReactElement<TokenProps>, links: Record<string, string>): React.ReactNode {
    const { children, ...props } = element.props;

    if (!children || Object.keys(links).length === 0) {
        return element;
    }

    const { children: childArray, texts, fullText } = extractChildrenInfo(element);

    if (!fullText) {
        return element;
    }

    const matches = findMatches(fullText, links);

    if (matches.length === 0) {
        return element;
    }

    const charToChild = buildCharToChildMap(texts);
    const newChildren: React.ReactNode[] = [];
    let currentChildIndex = 0;

    for (const match of matches) {
        const startInfo = charToChild[match.start];
        const endInfo = charToChild[match.end - 1];

        if (!startInfo || !endInfo) {
            continue;
        }

        // Add any children before this match
        while (currentChildIndex < startInfo.childIndex) {
            newChildren.push(childArray[currentChildIndex]);
            currentChildIndex++;
        }

        // Add partial child content before the match
        addChildBeforeMatch(newChildren, childArray, texts, startInfo.childIndex, startInfo.offsetInChild);

        // Collect matched elements and wrap in anchor tag
        const matchedElements = collectMatchedElements(
            childArray,
            texts,
            startInfo.childIndex,
            endInfo.childIndex,
            startInfo.offsetInChild,
            endInfo.offsetInChild
        );

        newChildren.push(
            <a
                key={`link-${match.start}`}
                href={match.url}
                target="_self"
                rel="noopener noreferrer"
                className="fern-code-link"
            >
                {matchedElements}
            </a>
        );

        // Add partial child content after the match
        addChildAfterMatch(newChildren, childArray, texts, endInfo.childIndex, endInfo.offsetInChild);

        currentChildIndex = endInfo.childIndex + 1;
    }

    // Add any remaining children after all matches
    while (currentChildIndex < childArray.length) {
        newChildren.push(childArray[currentChildIndex]);
        currentChildIndex++;
    }

    return React.cloneElement(element, props, ...newChildren);
}

export const HastToJSX: FC<HastToJSXProps> = memo(({ hast, template, links }) => {
    const tooltips = useContext(TemplateTooltip);

    const result = useMemo(
        () =>
            toJsxRuntime(hast, {
                Fragment,

                jsx: jsx as any,

                jsxs: jsxs as any
            }),
        [hast]
    );

    if (!isValidElement<{ children?: React.ReactNode }>(result)) {
        return result;
    }

    const processChild = (child: React.ReactNode, i: number): React.ReactNode => {
        // Handle template tokens
        if (isValidElement<TokenProps>(child) && child.props["data-template"]) {
            const tooltipContent = tooltips[child.props["data-template"]];
            const data = template?.[child.props["data-template"]];
            return (
                <TemplateToken key={i} tooltipContent={tooltipContent} data={data}>
                    {child}
                </TemplateToken>
            );
        }

        return child;
    };

    // Process template tokens first
    const withTemplates = React.cloneElement(
        result,
        undefined,
        ...React.Children.toArray(result.props.children).map(processChild)
    );

    // Then apply links across the entire line (to support multi-element patterns)
    if (links && Object.keys(links).length > 0 && isValidElement<TokenProps>(withTemplates)) {
        const withLinks = wrapTextWithLinks(withTemplates, links);
        if (withLinks !== withTemplates) {
            return <React.Fragment>{withLinks}</React.Fragment>;
        }
        return withTemplates;
    }

    return withTemplates;
});

function TemplateToken({
    children,
    tooltipContent,
    data
}: {
    children: React.ReactNode;
    tooltipContent?: React.ReactNode;
    data?: string;
}) {
    const { copyToClipboard, wasJustCopied } = useCopyToClipboard(() => data ?? "");
    const child = React.Children.only(children);
    if (!isValidElement<TokenProps>(child)) {
        throw new Error("TemplateToken must have exactly one child");
    }
    return (
        <FernTooltip
            content={wasJustCopied ? "Copied!" : tooltipContent}
            // tooltip is uncontrolled if wasJustCopied is false
            open={wasJustCopied ? true : undefined}
        >
            {React.cloneElement(
                child,
                {
                    className: cn(
                        child.props.className,
                        "bg-(color:--accent-a3) rounded-1 -m-0.5 cursor-default p-0.5",
                        !!data && "hover:bg-(color:--accent-a4) cursor-pointer"
                    ),
                    role: data ? "button" : undefined,
                    onClick: data ? () => void copyToClipboard?.() : undefined
                },
                data ?? child.props.children
            )}
        </FernTooltip>
    );
}

HastToJSX.displayName = "HastToJSX";
