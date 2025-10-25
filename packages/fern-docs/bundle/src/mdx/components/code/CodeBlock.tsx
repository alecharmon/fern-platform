import { cleanLanguage } from "@fern-api/fdr-sdk/api-definition";
import { CopyToClipboardButton } from "@fern-docs/components/CopyToClipboardButton";
import { cn } from "@fern-docs/components/cn";
import { ExpandCodeButton } from "@fern-docs/components/ExpandCodeButton";
import {
    CodeBlockWithClipboardButton,
    FernSyntaxHighlighter,
    type ScrollToHandle
} from "@fern-docs/components/syntax-highlighter";
import { type ComponentProps, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import { useIsDarkCode } from "@/state/dark-code";

import { applyTemplates, useTemplate } from "./Template";

function useCurrentHash() {
    const [hash, setHash] = useState("");

    useEffect(() => {
        const updateHash = () => setHash(window.location.hash);

        // Listen to hash changes
        window.addEventListener("hashchange", updateHash);

        // Poll as fallback for cases where hashchange doesn't fire (e.g., programmatic changes)
        const interval = setInterval(updateHash, 100);

        return () => {
            window.removeEventListener("hashchange", updateHash);
            clearInterval(interval);
        };
    }, []);

    return hash;
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
    /**
     * optional id for the code block, used for URL hash navigation and emphasis
     */
    id?: string;
}) {
    const {
        className,
        code = "",
        title,
        filename,
        language = "plaintext",
        template: templateProp,
        tooltips: tooltipsProp,
        id
    } = props;
    const isDarkCode = useIsDarkCode();
    // TODO: once this is in beta, we can add expandable logic for any code block greater than 20 lines
    // const expandable = props.maxLines != null || code.split("\n").length > 20;
    const expandable = props.maxLines != null;

    // merge context templates with the ones passed in
    const template = { ...useTemplate().template, ...templateProp };
    const tooltips = { ...useTemplate().tooltips, ...tooltipsProp };

    const viewportRef = useRef<ScrollToHandle>(null);
    const currentHash = useCurrentHash();
    const isEmphasized = id != null && currentHash === `#${id}`;

    useEffect(() => {
        const { current } = viewportRef;
        if (current && props.startLine != null) {
            // Convert to 0-based index
            current.scrollToLine(props.startLine - 1);
        }
    }, [props.startLine, viewportRef]);

    if (!code) {
        return null;
    }

    if (title || filename) {
        return (
            <div
                id={id}
                className={cn(
                    "bg-card-background border-card-border rounded-3 shadow-card-grayscale relative mb-6 mt-4 flex w-full min-w-0 max-w-full flex-col border first:mt-0",
                    { "bg-card-solid dark": isDarkCode },
                    isEmphasized && "ring-2 ring-(color:--accent) "
                )}
            >
                <div className="bg-(color:--grayscale-a2) rounded-t-[inherit]">
                    <div className="shadow-border-default mx-px flex min-h-10 items-center justify-between shadow-[inset_0_-1px_0_0]">
                        <div className="flex min-h-10 overflow-x-auto">
                            <div className="flex items-center px-3 py-1.5">
                                <span className="text-(color:--grayscale-a11) rounded-1 text-sm font-semibold">
                                    {title ?? language}
                                </span>
                            </div>
                        </div>
                        {expandable && (
                            <ExpandCodeButton
                                className={cn("fern-expand-button absolute right-9 z-20")}
                                content={code}
                                language={language}
                            />
                        )}
                        <CopyToClipboardButton className="ml-2 mr-1" content={() => applyTemplates(code, template)} />
                    </div>
                </div>
                <FernSyntaxHighlighter
                    {...toSyntaxHighlighterProps({
                        ...props,
                        template,
                        tooltips,
                        viewportRef
                    })}
                    className="rounded-b-[inherit]"
                />
            </div>
        );
    }

    return (
        <div id={id} className={cn(isEmphasized && "ring-2 ring-(color:--accent) rounded-3")}>
            <CodeBlockWithClipboardButton
                code={() => applyTemplates(code, template)}
                className={cn({ "bg-card-solid dark": isDarkCode }, className)}
                expandable={expandable}
                language={language}
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
        </div>
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
        links: props.links
    };
}
