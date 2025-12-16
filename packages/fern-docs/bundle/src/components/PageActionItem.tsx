"use client";

import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { t } from "@fern-docs/i18n";
import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { capturePosthogEventInternal } from "@/components/analytics/posthog";
import { ClaudeIcon, CursorIcon, MarkdownIcon, OpenAIIcon, SparklesIconHollow } from "./PageActionsAssets";

type PageActionItemProps = {
    option: FernDropdown.PageActionOption;
    lang: string;
    variant: "dropdown" | "toolbar" | "defaultOption";
    onCopyPage?: () => Promise<void>;
    showCopied?: boolean;
    onValueChange?: (value: string) => Promise<void>;
};

export function PageActionItem({ option, lang, variant, onCopyPage, showCopied, onValueChange }: PageActionItemProps) {
    if (option.type === "separator") {
        return null;
    }

    const { value, label, href } = option;

    const getIcon = (optionValue: string): ReactNode => {
        switch (optionValue) {
            case "copy-page":
                return showCopied ? (
                    <Check className="size-icon animate-in fade-in duration-200" />
                ) : (
                    <Copy className="size-icon animate-in fade-in duration-200" />
                );
            case "open-ai-search":
                return <SparklesIconHollow />;
            case "view-as-markdown":
                return <MarkdownIcon />;
            case "open-claude":
                return <ClaudeIcon />;
            case "open-chatgpt":
                return <OpenAIIcon />;
            case "open-cursor":
                return <CursorIcon />;
            default:
                return null;
        }
    };

    const getClassName = () => {
        if (variant === "toolbar") {
            return "px-2 py-1 rounded-2 text-(color:--grayscale-a11) whitespace-nowrap hover:bg-(color:--accent-a3) hover:text-(color:--accent-12) transition-colors flex items-center gap-1.5 cursor-pointer";
        }
        // For dropdown and defaultOption, styles are handled by parent components
        return "";
    };

    const getLabel = () => {
        if (value === "copy-page" && variant === "toolbar") {
            return (
                <span key={showCopied ? "copied" : "copy"} className="animate-in fade-in duration-200">
                    {showCopied ? t(lang).buttons.copied : t(lang).buttons.copyPage}
                </span>
            );
        }
        return label;
    };

    const getTitle = () => {
        switch (value) {
            case "copy-page":
                return t(lang).tooltips.copyPageMarkdown;
            case "open-ai-search":
                return t(lang).tooltips.askQuestion;
            case "view-as-markdown":
                return t(lang).tooltips.viewMarkdown;
            case "open-claude":
                return t(lang).tooltips.openClaude;
            default:
                return typeof label === "string" ? label : undefined;
        }
    };

    const handleClick = () => {
        if (value === "copy-page" && onCopyPage) {
            capturePosthogEventInternal("page_actions_dropdown", {
                type: "copy-button",
                page_location: window.location.pathname
            });
            void onCopyPage();
        } else if (onValueChange) {
            void onValueChange(value);
        } else {
            capturePosthogEventInternal("page_actions_dropdown", {
                type: value,
                page_location: window.location.pathname
            });
        }
    };

    // For copy-page action
    if (value === "copy-page") {
        if (variant === "defaultOption") {
            // Return the content that should be rendered inside the button
            return (
                <>
                    {getIcon(value)}
                    <span key={showCopied ? "copied" : "copy"} className="animate-in fade-in duration-300">
                        {showCopied ? t(lang).buttons.copied : t(lang).buttons.copyPage}
                    </span>
                </>
            );
        }

        return (
            <button key={value} onClick={handleClick} className={getClassName()} title={getTitle()}>
                {getIcon(value)}
                {getLabel()}
            </button>
        );
    }

    // For open-ai-search action
    if (value === "open-ai-search") {
        if (variant === "defaultOption") {
            return (
                <>
                    {getIcon(value)}
                    {label}
                </>
            );
        }

        return (
            <button key={value} onClick={handleClick} className={getClassName()} title={getTitle()}>
                {getIcon(value)}
                {label}
            </button>
        );
    }

    // For links (markdown, claude, chatgpt, cursor, etc.)
    if (href) {
        if (variant === "defaultOption") {
            return (
                <>
                    {getIcon(value)}
                    {label}
                </>
            );
        }

        return (
            <a
                key={value}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                    capturePosthogEventInternal("page_actions_dropdown", {
                        type: value === "view-as-markdown" ? "markdown" : value,
                        page_location: window.location.pathname
                    });
                }}
                className={getClassName()}
                title={getTitle()}
            >
                {getIcon(value)}
                {label}
            </a>
        );
    }

    // For other button actions
    if (variant === "defaultOption") {
        return (
            <>
                {getIcon(value)}
                {label}
            </>
        );
    }

    return (
        <button key={value} onClick={handleClick} className={getClassName()} title={getTitle()}>
            {getIcon(value)}
            {label}
        </button>
    );
}
