import { cleanLanguage } from "@fern-api/fdr-sdk/api-definition";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { ExpandCodeButton } from "@fern-docs/components/ExpandCodeButton";
import { useIsDarkCode } from "@fern-docs/components/state/dark-code";
import {
    CodeBlockWithClipboardButton,
    FernSyntaxHighlighter,
    type ScrollToHandle
} from "@fern-docs/components/syntax-highlighter";
import { type ComponentProps, type ReactNode, type RefObject, useEffect, useRef } from "react";

import { CodeBlockFeedbackButton } from "./CodeBlockFeedbackButton";
import { applyTemplates, useTemplate } from "./Template";

/**
 * Hook to scroll a code block to a specific line when it becomes active.
 * Uses double requestAnimationFrame to ensure the content is fully visible before scrolling.
 *
 * @param viewportRef - Ref to the scroll handle exposed by FernSyntaxHighlighter
 * @param startLine - 1-based line number to scroll to
 * @param isActive - Whether the code block is currently active/visible (defaults to true for standalone blocks)
 */
export function useScrollToStartLine(
    viewportRef: RefObject<ScrollToHandle | null>,
    startLine: number | undefined,
    isActive: boolean = true
): void {
    useEffect(() => {
        if (!isActive || startLine == null) {
            return;
        }
        // Use double requestAnimationFrame to ensure the content is fully visible
        // before scrolling. The first RAF waits for the current frame to complete,
        // the second ensures any visibility transitions have applied.
        let cancelled = false;
        requestAnimationFrame(() => {
            if (cancelled) {
                return;
            }
            requestAnimationFrame(() => {
                if (cancelled) {
                    return;
                }
                if (viewportRef.current) {
                    viewportRef.current.scrollToLine(startLine - 1); // Convert to 0-based index
                }
            });
        });
        return () => {
            cancelled = true;
        };
    }, [viewportRef, startLine, isActive]);
}

export function CodeBlock(props: {
    className?: string;
    /**
     * @default "plaintext"
     */
    language?: string;
    /**
     * overrides language for setting the global language state
     * @default language
     */
    for?: string;
    /**
     * @default ""
     */
    code?: string;
    /**
     * sets the lines to highlight
     */
    highlight?: number | number[];
    /**
     * sets the lines to focus
     */
    focus?: number | number[];
    title?: string;
    filename?: string;
    maxLines?: number;
    wordWrap?: boolean;
    /**
     * replaces handlebars in the code with the given values, i.e. {{API_KEY}} -> "1234567890"
     */
    template?: Record<string, string>;
    /**
     * enables rendering tooltips on handlebars in the code
     */
    tooltips?: Record<string, ReactNode>;
    /**
     * automatically scrolls to the specified line number (1-based) when the component mounts
     */
    startLine?: number;
    /**
     * maps exact string matches in the code to URLs, creating clickable links
     */
    links?: Record<string, string>;
    lang?: string;
    disableAnalytics?: boolean;
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
}) {
    const {
        className,
        code = "",
        title,
        filename,
        language = "plaintext",
        template: templateProp,
        tooltips: tooltipsProp,
        lang = "en"
    } = props;
    const isDarkCode = useIsDarkCode();
    // TODO: once this is in beta, we can add expandable logic for any code block greater than 20 lines
    // const expandable = props.maxLines != null || code.split("\n").length > 20;
    const expandable = props.maxLines != null;

    // merge context templates with the ones passed in
    const template = { ...useTemplate().template, ...templateProp };
    const tooltips = { ...useTemplate().tooltips, ...tooltipsProp };

    const viewportRef = useRef<ScrollToHandle>(null);
    useScrollToStartLine(viewportRef, props.startLine);

    if (!code) {
        return null;
    }

    if (title || filename) {
        return (
            <div
                className={cn(
                    "fern-code fern-code-block bg-card-background border-card-border rounded-3 shadow-card-grayscale relative mb-6 mt-4 flex w-full min-w-0 max-w-full flex-col border first:mt-0",
                    { "bg-card-solid dark": isDarkCode }
                )}
            >
                <div className="fern-code-header fern-code-block-header bg-(color:--grayscale-a2) rounded-t-[inherit]">
                    <div className="fern-code-header-inner fern-code-block-header-inner shadow-border-default mx-px flex min-h-10 items-center justify-between shadow-[inset_0_-1px_0_0]">
                        <div className="fern-code-block-title flex min-h-10 overflow-x-auto">
                            <div className="flex items-center px-3 py-1.5">
                                <span className="fern-code-label fern-code-block-title-label text-(color:--grayscale-a11) rounded-1 text-sm font-semibold">
                                    {title ?? language}
                                </span>
                            </div>
                        </div>
                        <div className="fern-code-actions fern-code-block-actions flex items-center gap-1">
                            {expandable && (
                                <ExpandCodeButton
                                    className={cn("fern-expand-button z-20")}
                                    content={code}
                                    language={language}
                                    lang={lang}
                                />
                            )}
                            <CodeBlockFeedbackButton className="z-20" code={code} language={language} lang={lang} />
                            <CopyToClipboardButton
                                className="mr-1"
                                content={() => applyTemplates(code, template)}
                                lang={lang}
                            />
                        </div>
                    </div>
                </div>
                <FernSyntaxHighlighter
                    {...toSyntaxHighlighterProps({
                        ...props,
                        template,
                        tooltips,
                        viewportRef
                    })}
                    className="fern-code-content fern-code-block-content rounded-b-[inherit]"
                />
            </div>
        );
    }

    return (
        <CodeBlockWithClipboardButton
            code={() => applyTemplates(code, template)}
            className={cn({ "bg-card-solid dark": isDarkCode }, className)}
            expandable={expandable}
            language={language}
            feedbackButton={
                <CodeBlockFeedbackButton className="fern-feedback-button" code={code} language={language} lang={lang} />
            }
            lang={lang}
        >
            <FernSyntaxHighlighter
                {...toSyntaxHighlighterProps({
                    ...props,
                    template,
                    tooltips,
                    viewportRef
                })}
            />
        </CodeBlockWithClipboardButton>
    );
}

export function toSyntaxHighlighterProps(
    props: ComponentProps<typeof CodeBlock> & {
        viewportRef?: RefObject<ScrollToHandle | null>;
    }
): ComponentProps<typeof FernSyntaxHighlighter> {
    const highlight = props.highlight ?? props.focus ?? [];
    return {
        language: cleanLanguage(props.language ?? "plaintext"),
        highlightLines: typeof highlight === "number" ? [highlight] : highlight,
        highlightStyle: props.focus != null ? "focus" : "highlight",
        code: props.code ?? "",
        maxLines: props.maxLines ?? 20,
        wordWrap: props.wordWrap,
        template: props.template,
        tooltips: props.tooltips,
        viewportRef: props.viewportRef,
        links: props.links,
        showLineNumbers: props.showLineNumbers,
        hideLinePrefixes: props.hideLinePrefixes
    };
}
