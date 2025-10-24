"use client";

import { FernButton } from "@fern-docs/components/FernButton";
import { FernDropdown } from "@fern-docs/components/FernDropdown";
import { useSetAtom } from "jotai";
import { Check, ChevronDown, Copy } from "lucide-react";
import type { ParamValue } from "next/dist/server/request/params";
import { useParams } from "next/navigation";
import { useState } from "react";

import { capturePosthogEventInternal } from "@/components/analytics/posthog";
import { useIsAskAiEnabled } from "@/state/search";
import { searchPanelOpenAtom, useSetPageContext } from "@/state/search-panel";

import { OpenAISearchOption, Separator } from "./PageActionsDropdownOptions";

export function PageActionsDropdown({
    markdownPromise,
    pageActionOptions
}: {
    markdownPromise?: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
    pageActionOptions: FernDropdown.PageActionOption[];
}) {
    const [showCopied, setShowCopied] = useState<boolean>(false);
    const { domain, slug } = useParams();

    // this is used to open the search dialog, and then AI chat
    // const setSearchDialogState = useSetAtom(searchDialogOpenAtom);
    const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
    const setPageContext = useSetPageContext();
    const isAskAiEnabled = useIsAskAiEnabled();

    const options = isAskAiEnabled ? [OpenAISearchOption(), Separator(), ...pageActionOptions] : pageActionOptions;

    if (options.length === 0) {
        return null;
    }

    const handleValueChange = async (value: string) => {
        if (value === "copy-page") {
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
        } else if (value === "open-ai-search") {
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
        } else if (value === "view-as-markdown") {
            capturePosthogEventInternal("page_actions_dropdown", {
                type: "markdown",
                page_location: window.location.pathname
            });
        }
    };

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
                        <span>Copied!</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Copy className="size-icon" />
                        <span>Copy page</span>
                    </div>
                )}
            </FernButton>
            <FernDropdown
                options={options}
                onValueChange={(value) => void handleValueChange(value)}
                dropdownMenuElement={<a target="_blank" rel="noopener noreferrer" />}
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
