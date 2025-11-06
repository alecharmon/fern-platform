"use client";

import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { t } from "@fern-docs/i18n";
import { useSetAtom } from "jotai";
import { Check, ChevronDown, Copy } from "lucide-react";
import type { ParamValue } from "next/dist/server/request/params";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import { capturePosthogEventInternal } from "@/components/analytics/posthog";
import { useIsAskAiEnabled } from "@/state/search";
import { searchPanelOpenAtom, useSetPageContext } from "@/state/search-panel";

import { OpenAISearchOption, Separator } from "./PageActionsDropdownOptions";

export function PageActionsDropdown({
    markdownPromise,
    pageActionOptions,
    lang,
    style = "default"
}: {
    markdownPromise?: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
    pageActionOptions: FernDropdown.PageActionOption[];
    lang: string;
    style?: "default" | "toolbar";
}) {
    const [showCopied, setShowCopied] = useState<boolean>(false);
    const { domain, slug } = useParams();

    // this is used to open the search dialog, and then AI chat
    // const setSearchDialogState = useSetAtom(searchDialogOpenAtom);
    const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
    const setPageContext = useSetPageContext();
    const isAskAiEnabled = useIsAskAiEnabled();

    const options = isAskAiEnabled
        ? [OpenAISearchOption({ lang }), Separator(), ...pageActionOptions]
        : pageActionOptions;

    if (options.length === 0) {
        return null;
    }

    const handleCopyPage = async () => {
        window.focus();

        if (markdownPromise) {
            try {
                const markdownResult = await markdownPromise;
                const markdown = markdownResult?.content;

                if (markdown) {
                    await navigator.clipboard.writeText(markdown);
                    capturePosthogEventInternal("page_actions_dropdown", {
                        type: "copy-option",
                        page_location: window.location.pathname
                    });

                    setShowCopied(true);

                    setTimeout(() => {
                        setShowCopied(false);
                    }, 2000);
                }
            } catch (error) {
                console.error("Failed to copy to clipboard:", error);
            }
        }
    };

    const handleAskAI = () => {
        const pageContext = {
            title: document.title,
            url: constructPageUrl(domain, slug)
        };
        setPageContext(pageContext);
        setSearchPanelState(true);
        capturePosthogEventInternal("page_actions_dropdown", {
            type: "ai-search",
            page_location: window.location.pathname
        });
    };

    const handleValueChange = async (value: string) => {
        if (value === "copy-page") {
            await handleCopyPage();
        } else if (value === "open-ai-search") {
            handleAskAI();
        } else if (value === "view-as-markdown") {
            capturePosthogEventInternal("page_actions_dropdown", {
                type: "markdown",
                page_location: window.location.pathname
            });
        } else {
            capturePosthogEventInternal("page_actions_dropdown", {
                type: value,
                page_location: window.location.pathname
            });
        }
    };

    if (style === "toolbar") {
        const renderInlineLink = (option: FernDropdown.PageActionOption) => {
            if (option.type === "separator") {
                return null;
            }

            const { value, label, href } = option;

            if (value === "copy-page") {
                return (
                    <button
                        key={value}
                        onClick={() => {
                            capturePosthogEventInternal("page_actions_dropdown", {
                                type: "copy-button",
                                page_location: window.location.pathname
                            });
                            void handleCopyPage();
                        }}
                        className="hover:underline text-(color:--grayscale-a11) whitespace-nowrap"
                    >
                        {showCopied ? t(lang).buttons.copied : t(lang).buttons.copyPage}
                    </button>
                );
            }

            if (value === "open-ai-search") {
                return (
                    <button
                        key={value}
                        onClick={handleAskAI}
                        className="hover:underline text-(color:--grayscale-a11) whitespace-nowrap"
                    >
                        {label}
                    </button>
                );
            }

            if (value === "view-as-markdown" && href) {
                return (
                    <a
                        key={value}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                            capturePosthogEventInternal("page_actions_dropdown", {
                                type: "markdown",
                                page_location: window.location.pathname
                            });
                        }}
                        className="hover:underline text-(color:--grayscale-a11) whitespace-nowrap"
                    >
                        {label}
                    </a>
                );
            }

            if (href) {
                return (
                    <a
                        key={value}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                            capturePosthogEventInternal("page_actions_dropdown", {
                                type: value,
                                page_location: window.location.pathname
                            });
                        }}
                        className="hover:underline text-(color:--grayscale-a11) whitespace-nowrap"
                    >
                        {label}
                    </a>
                );
            }

            return (
                <button
                    key={value}
                    onClick={() => {
                        capturePosthogEventInternal("page_actions_dropdown", {
                            type: value,
                            page_location: window.location.pathname
                        });
                    }}
                    className="hover:underline text-(color:--grayscale-a11) whitespace-nowrap"
                >
                    {label}
                </button>
            );
        };

        const allOptions = isAskAiEnabled ? [OpenAISearchOption({ lang }), ...pageActionOptions] : pageActionOptions;
        const items = allOptions.filter((option) => option.type !== "separator");

        if (items.length === 0) {
            return null;
        }

        const MAX_VISIBLE = 3;
        const visibleItems = items.slice(0, MAX_VISIBLE);
        const overflowItems = items.slice(MAX_VISIBLE);

        return (
            <div className="fern-page-actions flex flex-wrap items-center text-sm">
                {visibleItems.map((item, i) => (
                    <Fragment key={item.value}>
                        {i > 0 && (
                            <span aria-hidden="true" className="px-1 text-(color:--grayscale-a8)">
                                |
                            </span>
                        )}
                        {renderInlineLink(item)}
                    </Fragment>
                ))}
                {overflowItems.length > 0 && (
                    <>
                        {visibleItems.length > 0 && (
                            <span aria-hidden="true" className="px-1 text-(color:--grayscale-a8)">
                                |
                            </span>
                        )}
                        <FernDropdown
                            options={overflowItems}
                            onValueChange={(value) => void handleValueChange(value)}
                            dropdownMenuElement={<a target="_blank" rel="noopener noreferrer" />}
                            lang={lang}
                        >
                            <button
                                aria-label={t(lang).buttons.moreActions}
                                className="px-1 text-(color:--grayscale-a11)"
                            >
                                …
                            </button>
                        </FernDropdown>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="fern-page-actions">
            <FernButton
                variant="minimal"
                className="w-fit rounded-r-none px-2"
                onClick={() => {
                    capturePosthogEventInternal("page_actions_dropdown", {
                        type: "copy-button",
                        page_location: window.location.pathname
                    });
                    void handleValueChange("copy-page");
                }}
            >
                {showCopied ? (
                    <div className="flex items-center gap-2">
                        <Check className="size-icon" />
                        <span>{t(lang).buttons.copied}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Copy className="size-icon" />
                        <span>{t(lang).buttons.copyPage}</span>
                    </div>
                )}
            </FernButton>
            <FernDropdown
                options={options}
                onValueChange={(value) => void handleValueChange(value)}
                dropdownMenuElement={<a target="_blank" rel="noopener noreferrer" />}
                lang={lang}
            >
                <FernButton
                    variant="minimal"
                    className="rounded-l-none px-2"
                    onClick={() => {
                        capturePosthogEventInternal("page_actions_dropdown", {
                            type: "open",
                            page_location: window.location.pathname
                        });
                    }}
                >
                    <ChevronDown className="size-icon" />
                </FernButton>
            </FernDropdown>
        </div>
    );
}

function constructPageUrl(domain: ParamValue, slug: ParamValue) {
    return `https://${domain as string}${decodeURIComponent(slug as string)}`;
}
