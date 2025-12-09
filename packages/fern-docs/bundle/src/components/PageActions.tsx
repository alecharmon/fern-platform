"use client";

import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { useSetAtom } from "jotai";
import type { ParamValue } from "next/dist/server/request/params";
import { useParams } from "next/navigation";
import { capturePosthogEventInternal } from "@/components/analytics/posthog";
import { useIsAskAiEnabled } from "@/state/search";
import { searchPanelOpenAtom, useSetPageContext } from "@/state/search-panel";
import { PageActionsDefault } from "./PageActionsDefault";
import { OpenAISearchOption } from "./PageActionsOptions";
import { PageActionsToolbar } from "./PageActionsToolbar";

export function PageActions({
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
    const { domain, slug } = useParams();

    // this is used to open the search dialog, and then AI chat
    const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
    const setPageContext = useSetPageContext();
    const isAskAiEnabled = useIsAskAiEnabled();

    const options = isAskAiEnabled ? [OpenAISearchOption({ lang }), ...pageActionOptions] : pageActionOptions;

    // use default option if specified, else copy page, else first option
    const defaultOption: FernDropdown.ValueOption | undefined =
        pageActionOptions.find(
            (option): option is FernDropdown.ValueOption => option.type === "value" && option.default === true
        ) ??
        options.find(
            (option): option is FernDropdown.ValueOption => option.type === "value" && option.value === "copy-page"
        ) ??
        (options[0]?.type === "value" ? options[0] : undefined);

    if (defaultOption) {
        options.splice(options.indexOf(defaultOption), 1);
        options.unshift(defaultOption);
    }

    if (options.length === 0 || !defaultOption) {
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
                    return true; // indicate success
                }
            } catch (error) {
                console.error("Failed to copy to clipboard:", error);
            }
        }
        return false; // indicate failure
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
        return (
            <PageActionsToolbar
                options={options}
                lang={lang}
                onValueChange={handleValueChange}
                onCopyPage={handleCopyPage}
            />
        );
    }

    return (
        <PageActionsDefault
            options={options}
            defaultOption={defaultOption}
            lang={lang}
            onValueChange={handleValueChange}
            onCopyPage={handleCopyPage}
        />
    );
}

function constructPageUrl(domain: ParamValue, slug: ParamValue) {
    return `https://${domain as string}${decodeURIComponent(slug as string)}`;
}
