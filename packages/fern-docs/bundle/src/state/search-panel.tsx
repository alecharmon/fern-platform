"use client";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { cn } from "@fern-docs/components/cn";
import { FERN_ASK_AI_BUTTON_ICON_ID, FERN_ASK_AI_BUTTON_ID } from "@fern-docs/components/constants";
import { FernButton } from "@fern-docs/components/FernButton";
import { t } from "@fern-docs/i18n";
import { atom, useAtomValue, useSetAtom } from "jotai";
import React, { useCallback } from "react";
import { SparklesIcon } from "@/components/PageActionsAssets";
import { useIsAskAiEnabled } from "@/state/search";

export const searchPanelInitializedAtom = atom(false);
export const searchPanelOpenAtom = atom(false);
export const searchPanelResizingAtom = atom(false);
export const searchPanelInitialInputAtom = atom<string>("");
export const searchPanelDraftInputAtom = atom<string>("");

export interface PageContext {
    title: string;
    url: string;
}

export const pageContextAtom = atom<PageContext | null>(null);

export const SearchPanelTrigger = React.memo(function SearchPanelTrigger({
    isSearchInSidebar = false,
    lang
}: {
    isSearchInSidebar?: boolean;
    lang: string;
}) {
    const isInitialized = useAtomValue(searchPanelInitializedAtom);
    const toggleAskAiSidePanel = useToggleSearchPanel();
    const isLocalEnvironment = isLocal();

    return (
        <FernButton
            id={FERN_ASK_AI_BUTTON_ID}
            variant="outlined"
            rightIcon={
                <SparklesIcon
                    id={FERN_ASK_AI_BUTTON_ICON_ID}
                    fill="var(--accent)"
                    className="h-[16.667px] w-[16.667px]"
                />
            }
            text={isSearchInSidebar ? "" : t(lang).search.askAI}
            className={cn(
                "text-(color:--grayscale-a11) h-9 w-fit flex-shrink-0 font-normal",
                isSearchInSidebar && "w-9",
                (!isInitialized || isLocalEnvironment) && "cursor-not-allowed"
            )}
            onClick={toggleAskAiSidePanel}
        />
    );
});

export function useIsSearchPanelOpen(): boolean {
    return useAtomValue(searchPanelOpenAtom);
}

export function useOpenSearchPanel(): () => void {
    const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
    return () => setSearchPanelState(true);
}

export function useCloseSearchPanel(): () => void {
    const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
    return () => setSearchPanelState(false);
}

export function useToggleSearchPanel(): () => void {
    const setSearchPanelState = useSetAtom(searchPanelOpenAtom);
    return () => setSearchPanelState((prev) => !prev);
}

export function useIsSearchPanelResizing(): boolean {
    return useAtomValue(searchPanelResizingAtom);
}

export function useSetSearchPanelResizing(): (resizing: boolean) => void {
    const setResizingState = useSetAtom(searchPanelResizingAtom);
    return setResizingState;
}

export function usePageContext(): PageContext | null {
    return useAtomValue(pageContextAtom);
}

export function useSetPageContext(): (context: PageContext | null) => void {
    const setPageContext = useSetAtom(pageContextAtom);
    return setPageContext;
}

/**
 * Returns a callback that renders an Ask AI button for code snippets, or undefined if Ask AI is disabled.
 * The button sets the draft input with the code content and opens the search panel.
 */
export function useAskAiCodeSnippetButton(
    lang: string
): (getContent: () => string, type: "request" | "response") => React.ReactNode | undefined {
    const isAskAiEnabled = useIsAskAiEnabled();
    const setDraftInput = useSetAtom(searchPanelDraftInputAtom);
    const openSearchPanel = useOpenSearchPanel();

    return useCallback(
        (getContent: () => string, type: "request" | "response") => {
            if (!isAskAiEnabled) {
                return undefined;
            }
            return (
                <FernButton
                    icon={<SparklesIcon fill="currentColor" className="size-3.5" />}
                    size="small"
                    variant="minimal"
                    aria-label={t(lang).search.askAI}
                    onClick={() => {
                        const content = getContent();
                        const codeLang = type === "response" ? "json" : "";
                        setDraftInput(`I have a question about this ${type}:\n\n\`\`\`${codeLang}\n${content}\n\`\`\``);
                        openSearchPanel();
                    }}
                />
            );
        },
        [isAskAiEnabled, setDraftInput, openSearchPanel, lang]
    );
}
